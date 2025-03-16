// Array dei partecipanti fissi
const participants = ["Sara", "Valerio", "Rachele", "Francesco", "Giuseppe", "Cristiano", "Francesca", "Viviana"];

// Variabili per il sorteggio
let currentAngle = 0;
let spinTime = 0;
let spinTimeTotal = 0;
let spinning = false;
let spinAnimationFrame;

// Raccolta delle mete al click del pulsante "Inizia il Sorteggio"
document.getElementById('startButton').addEventListener('click', function() {
  let destinations = [];
  for (let i = 1; i <= participants.length; i++) {
    let dest = document.getElementById('destination' + i).value.trim();
    if (dest === '') {
      alert('Per favore, inserisci la meta per ' + participants[i - 1]);
      return;
    }
    destinations.push({ dest: dest, name: participants[i - 1] });
  }
  // Nascondi la schermata di inserimento e mostra la ruota
  document.getElementById('input-container').style.display = 'none';
  document.getElementById('wheel-container').style.display = 'block';
  
  // Disegna la ruota iniziale
  drawWheel(destinations, currentAngle);
  
  // Salva globalmente l'array delle mete
  window.destinations = destinations;
});

// Gestione del pulsante per far girare la ruota
document.getElementById('spinButton').addEventListener('click', function() {
  if (spinning) return;
  spinning = true;
  spinTime = 0;
  // Tempo di rotazione casuale tra 3 e 6 secondi
  spinTimeTotal = Math.random() * 3000 + 3000;
  rotateWheel();
});

function rotateWheel() {
  spinTime += 30;
  if (spinTime >= spinTimeTotal) {
    stopRotateWheel();
    return;
  }
  // Easing per una rotazione più fluida
  let spinAngle = easeOut(spinTime, 0, Math.PI * 10, spinTimeTotal);
  currentAngle += spinAngle;
  drawWheel(window.destinations, currentAngle);
  spinAnimationFrame = requestAnimationFrame(rotateWheel);
}

function stopRotateWheel() {
  cancelAnimationFrame(spinAnimationFrame);
  let numSegments = window.destinations.length;
  let arc = 2 * Math.PI / numSegments;
  // Il puntatore è posizionato in alto (-90°)
  let pointerAngle = (2 * Math.PI + (-Math.PI/2 - (currentAngle % (2 * Math.PI)))) % (2 * Math.PI);
  let winningIndex = Math.floor(pointerAngle / arc);
  
  // Mostra il risultato dopo una breve pausa
  setTimeout(function() {
    document.getElementById('wheel-container').style.display = 'none';
    document.getElementById('result-container').style.display = 'block';
    let winner = window.destinations[winningIndex];
    document.getElementById('winnerInfo').innerHTML = '<strong>' + winner.name + '</strong> ha scelto <strong>' + winner.dest + '</strong>!';
  }, 1000);
  spinning = false;
}

function easeOut(t, b, c, d) {
  t /= d;
  let ts = t * t;
  let tc = ts * t;
  return b + c * (tc - 3 * ts + 3 * t);
}

function drawWheel(destinations, rotation = 0) {
  let canvas = document.getElementById('wheelCanvas');
  let ctx = canvas.getContext('2d');
  let centerX = canvas.width / 2;
  let centerY = canvas.height / 2;
  let outsideRadius = Math.min(centerX, centerY) - 10;
  let textRadius = outsideRadius - 30;
  let numSegments = destinations.length;
  let arc = 2 * Math.PI / numSegments;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  for (let i = 0; i < numSegments; i++) {
    let angle = rotation + i * arc;
    // Palette di colori pastello
    ctx.fillStyle = getColor(i);
    
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, outsideRadius, angle, angle + arc, false);
    ctx.lineTo(centerX, centerY);
    ctx.fill();
    
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Disegna il testo con il nome della meta e del partecipante
    ctx.save();
    ctx.fillStyle = "#000";
    ctx.translate(centerX, centerY);
    ctx.rotate(angle + arc / 2);
    let text = destinations[i].dest + " (" + destinations[i].name + ")";
    ctx.textAlign = "right";
    ctx.font = "bold 14px Poppins";
    ctx.fillText(text, textRadius, 0);
    ctx.restore();
  }
}

function getColor(index) {
  const colors = ["#FFB6C1", "#87CEFA", "#90EE90", "#FFD700", "#FF69B4", "#FFA07A", "#98FB98", "#87CEEB"];
  return colors[index % colors.length];
}

document.getElementById('restartButton').addEventListener('click', function() {
  location.reload();
});

