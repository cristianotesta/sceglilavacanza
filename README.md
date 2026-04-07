# MRO Smart Auditor

Gateway di Audit per la conformità documentale aeronautica (EASA Part-145).
Confronta le pagine di una **Task Card** con un **Manuale Istruzioni Cliente** e genera un report dettagliato delle non conformità.

## Requisiti di Sistema

- Python 3.11+
- **Poppler** (necessario per pdf2image):
  - Ubuntu/Debian: `sudo apt-get install poppler-utils`
  - macOS: `brew install poppler`
  - Windows: scarica i binari da https://github.com/oschwartz10612/poppler-windows e aggiungili al PATH

## Installazione

```bash
pip install -r requirements.txt
