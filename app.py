import os
import json
from flask import Flask, render_template, request, jsonify
from pdf2image import convert_from_bytes
import google.generativeai as genai
from google.api_core import exceptions as google_exceptions
from io import BytesIO
from PIL import Image

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max

SYSTEM_PROMPT = """Sei un Auditor EASA Part-145 con esperienza trentennale in ispezioni documentali MRO (Maintenance, Repair and Overhaul).
La tua analisi deve essere rigorosa, metodica e deterministica.

REGOLE FONDAMENTALI (NON DEROGABILI):
1. Non inventare mai riferimenti. Se un'anomalia non ha un riferimento esplicito nel manuale istruzioni fornito, segnalala esattamente come: 'Non conformità agli standard generali di manutenzione (EASA Part-145)'.
2. Ogni sessione di caricamento è completamente isolata. Ignora qualsiasi dato, contesto o analisi precedenti.
3. Analizza per l'audit SOLO i moduli che corrispondono ai moduli del cliente descritti nel Manuale Istruzioni. I moduli interni aziendali devono essere identificati e ignorati ai fini dell'audit.
4. Nelle coordinate spaziali usa sempre terminologia precisa: 'Box [Nome Campo]', 'Angolo superiore destro', 'Header centrale', 'Footer sinistro', 'Colonna [N]', 'Riga [N]', etc.
5. Sii deterministico: non speculare, non ipotizzare, riporta solo ciò che è verificabile visivamente."""

ANALYSIS_INSTRUCTIONS = """
## ISTRUZIONI PER L'ANALISI

Esegui i seguenti passi nell'ordine indicato:

**PASSO 1 — IDENTIFICAZIONE MODULO**
Per ogni pagina della Task Card, determina se il modulo è:
- "cliente": corrisponde a un layout descritto/mostrato nel Manuale Istruzioni del cliente
- "interno": modulo aziendale interno non coperto dal Manuale

Procedi all'audit di conformità SOLO per le pagine di tipo "cliente".

**PASSO 2 — AUDIT DI CONFORMITÀ (solo moduli cliente)**
Per ogni modulo cliente verifica:
- Presenza e leggibilità di firme e timbri richiesti
- Correttezza e coerenza delle date
- Completezza di tutti i campi obbligatori
- Posizionamento corretto delle informazioni secondo il Manuale
- Ogni altra non conformità rispetto alle istruzioni del Manuale

**PASSO 3 — OUTPUT**
Rispondi ESCLUSIVAMENTE con un array JSON valido. Non aggiungere testo, spiegazioni o markdown prima o dopo il JSON.
Il formato è il seguente:

[
  {
    "pagina": <numero intero>,
    "modulo": "<nome o tipologia del modulo, es. Boeing Job Card Rev.3>",
    "tipo_modulo": "<'cliente' oppure 'interno'>",
    "anomalie": [
      {
        "anomalia": "<descrizione precisa e concisa del problema riscontrato>",
        "zona_posizione": "<localizzazione spaziale esatta, es. Box 'Inspector Stamp' — Angolo inferiore destro>",
        "riferimento_manuale": "<citazione testuale della regola violata con numero di pagina del Manuale, oppure 'Non conformità agli standard generali di manutenzione (EASA Part-145)'>"
      }
    ]
  }
]

Regole per l'output:
- Includi TUTTE le pagine della Task Card nell'array, anche quelle di tipo "interno".
- Per le pagine "interno", imposta anomalie: [].
- Per le pagine "cliente" senza anomalie, imposta anomalie: [].
- Non omettere nessuna pagina.
"""


def pdf_to_pil_images(pdf_bytes: bytes, dpi: int = 150) -> list:
    """Convert PDF bytes to a list of PIL JPEG images."""
    raw = convert_from_bytes(pdf_bytes, dpi=dpi)
    result = []
    for img in raw:
        buf = BytesIO()
        img.save(buf, format="JPEG", quality=85)
        buf.seek(0)
        result.append(Image.open(buf).copy())
    return result


def build_parts(tc_images: list, manual_images: list) -> list:
    """Build Gemini multimodal content parts list."""
    parts = []

    parts.append(
        f"## MANUALE ISTRUZIONI DEL CLIENTE ({len(manual_images)} pagine)\n"
        "Questo documento definisce: come si identificano i moduli del cliente, "
        "quali campi devono essere compilati, dove devono essere apposti timbri e firme, "
        "e ogni altra regola di conformità documentale."
    )
    for i, img in enumerate(manual_images):
        parts.append(f"### Manuale — Pagina {i + 1}:")
        parts.append(img)

    parts.append(
        f"\n## TASK CARD DA SOTTOPORRE AD AUDIT ({len(tc_images)} pagine)\n"
        "Queste sono le pagine della Task Card da analizzare per la conformità documentale."
    )
    for i, img in enumerate(tc_images):
        parts.append(f"### Task Card — Pagina {i + 1}:")
        parts.append(img)

    parts.append(ANALYSIS_INSTRUCTIONS)
    return parts


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/analyze", methods=["POST"])
def analyze():
    api_key = request.form.get("api_key", "").strip()
    if not api_key:
        api_key = os.environ.get("GOOGLE_API_KEY", "")
    if not api_key:
        return jsonify({"error": "Gemini API Key non fornita. Inseriscila nel form o impostala come variabile d'ambiente GOOGLE_API_KEY."}), 400

    if "task_card" not in request.files or "instructions_manual" not in request.files:
        return jsonify({"error": "Entrambi i file PDF sono necessari."}), 400

    task_card_file = request.files["task_card"]
    manual_file = request.files["instructions_manual"]

    if not task_card_file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "La Task Card deve essere un file PDF."}), 400
    if not manual_file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Il Manuale Istruzioni deve essere un file PDF."}), 400

    try:
        task_card_bytes = task_card_file.read()
        manual_bytes = manual_file.read()
    except Exception as e:
        return jsonify({"error": f"Errore nella lettura dei file: {e}"}), 400

    try:
        tc_images = pdf_to_pil_images(task_card_bytes)
        manual_images = pdf_to_pil_images(manual_bytes)
    except Exception as e:
        return jsonify({"error": f"Errore nella conversione PDF→immagini: {e}. Assicurati che Poppler sia installato."}), 500

    raw_text = ""
    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            model_name="gemini-2.0-flash",
            system_instruction=SYSTEM_PROMPT,
            generation_config=genai.GenerationConfig(
                temperature=0.0,
                max_output_tokens=8192,
            )
        )

        parts = build_parts(tc_images, manual_images)
        response = model.generate_content(parts)
        raw_text = response.text.strip()

        if raw_text.startswith("```"):
            first_newline = raw_text.find("\n")
            raw_text = raw_text[first_newline + 1:]
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3].strip()

        results = json.loads(raw_text)

    except google_exceptions.PermissionDenied:
        return jsonify({"error": "API Key Gemini non valida o non autorizzata."}), 401
    except google_exceptions.ResourceExhausted:
        return jsonify({"error": "Quota Gemini API esaurita. Riprova tra qualche minuto."}), 429
    except google_exceptions.GoogleAPIError as e:
        return jsonify({"error": f"Errore API Google: {e}"}), 502
    except json.JSONDecodeError as e:
        preview = raw_text[:500] if raw_text else "(vuota)"
        return jsonify({"error": f"Risposta AI non parsabile come JSON: {e}\n\nRisposta grezza:\n{preview}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    total_anomalies = sum(len(p.get("anomalie", [])) for p in results)
    client_pages = sum(1 for p in results if p.get("tipo_modulo") == "cliente")

    return jsonify({
        "success": True,
        "results": results,
        "stats": {
            "total_pages": len(tc_images),
            "client_pages": client_pages,
            "internal_pages": len(tc_images) - client_pages,
            "total_anomalies": total_anomalies
        }
    })


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
