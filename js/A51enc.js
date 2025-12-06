/* A5/1 Encryption/Decryption Logic
   Final Integrated Version: Terminal UI + Hex Output
*/

// --- DOM Elements ---
var keyele = document.getElementById('inputKey');
var frameele = document.getElementById('inputFrame');

var inpmessu1 = document.getElementById('inpmessu1');
var outmessu1 = document.getElementById('outmessu1');

var inpmessu2 = document.getElementById('inpmessu2');
var outmessu2 = document.getElementById('outmessu2');

// --- A5/1 Constants & Masks ---
const hexToDecimal = hex => parseInt(hex, 16);

// Masks to keep registers at correct bit lengths (19, 22, 23 bits)
const R1Mask = hexToDecimal("0x07FFFF"); 
const R2Mask = hexToDecimal("0x3FFFFF");
const R3Mask = hexToDecimal("0x7FFFFF");

// Middle bits for majority clocking
const R1mid = hexToDecimal("0x000100"); // Bit 8
const R2mid = hexToDecimal("0x000400"); // Bit 10
const R3mid = hexToDecimal("0x000400"); // Bit 10

// Feedback Taps
const R1taps = hexToDecimal("0x072000"); 
const R2taps = hexToDecimal("0x300000");
const R3taps = hexToDecimal("0x700080");

// Output bits (MSB of each register)
const R1OUT = hexToDecimal("0x040000"); // Bit 18
const R2OUT = hexToDecimal("0x200000"); // Bit 21
const R3OUT = hexToDecimal("0x400000"); // Bit 22

var R1, R2, R3;
var AtoB = [], BtoA = []; 

// --- UI Helper: Write to Terminal Window ---
function uiLog(message, type = "info") {
    const terminal = document.getElementById('console-display');
    const line = document.createElement('div');
    line.className = 'log-line';
    
    let prefix = "[INFO]";
    let cssClass = "log-info";

    if (type === "success") { prefix = "[OK]"; cssClass = "log-success"; }
    else if (type === "warn") { prefix = "[WARN]"; cssClass = "log-warn"; }
    else if (type === "data") { prefix = ">>"; cssClass = "log-data"; }

    // Timestamp
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour12: false });

    line.innerHTML = `<span class="cmd">${time}</span> <span class="${cssClass}">${prefix}</span> ${message}`;
    
    if(terminal) {
        terminal.appendChild(line);
        terminal.scrollTop = terminal.scrollHeight; // Auto-scroll to bottom
    }
}

// --- Core A5/1 Logic Functions ---

function parity(x) {
    x ^= x >> 16;
    x ^= x >> 8;
    x ^= x >> 4;
    x ^= x >> 2;
    x ^= x >> 1;
    return x & 1;
}

function clockone(reg, mask, tap) {
    var t = reg & tap;
    reg = (reg << 1) & mask;
    reg |= parity(t);
    return reg;
}

function clockallthree() {
    R1 = clockone(R1, R1Mask, R1taps);
    R2 = clockone(R2, R2Mask, R2taps);
    R3 = clockone(R3, R3Mask, R3taps);
}

function majority() {
    let sum = parity(R1 & R1mid) + parity(R2 & R2mid) + parity(R3 & R3mid);
    return (sum >= 2) ? 1 : 0;
}

function clock() {
    let maj = majority();
    if (((R1 & R1mid) != 0) == maj)
        R1 = clockone(R1, R1Mask, R1taps);
    if (((R2 & R2mid) != 0) == maj)
        R2 = clockone(R2, R2Mask, R2taps);
    if (((R3 & R3mid) != 0) == maj)
        R3 = clockone(R3, R3Mask, R3taps);
}

function keysetup(key, frame) {
    R1 = R2 = R3 = 0;
    var keybit, framebit;
    let i = 0;
    
    // Load Key
    for (i = 0; i < 64; i++) {
        clockallthree();
        keybit = (key[Math.floor(i / 8)] >> (i & 7)) & 1;
        R1 ^= keybit; R2 ^= keybit; R3 ^= keybit;
    }

    // Load Frame
    for (i = 0; i < 22; i++) {
        clockallthree();
        framebit = (frame >> i) & 1;
        R1 ^= framebit; R2 ^= framebit; R3 ^= framebit;
    }

    // 100 Cycles to mix
    for (i = 0; i < 100; i++) {
        clock();
    }
}

function getbit() {
    return parity(R1 & R1OUT) ^ parity(R2 & R2OUT) ^ parity(R3 & R3OUT);
}

function run(AtoB, BtoA) {
    let i;
    // Reset arrays
    for (i = 0; i <= Math.floor(113 / 8); i++) {
        AtoB[i] = BtoA[i] = 0;
    }
    
    // Generate Keystream A -> B
    for (i = 0; i < 114; i++) {
        clock();
        AtoB[Math.floor(i / 8)] |= getbit() << (7 - (i & 7));
    }
    
    // Generate Keystream B -> A
    for (i = 0; i < 114; i++) {
        clock();
        BtoA[Math.floor(i / 8)] |= getbit() << (7 - (i & 7));
    }
}

function generateKeyLogic(hex, f) {
    uiLog("Initializing System Registers...", "info");
    
    key = [];
    
    // Robust Hex Parsing
    if (hex.length % 2 != 0) hex = "0" + hex;
    for (let j = 0; j < hex.length; j += 2) {
        let byteVal = parseInt(hex.substr(j, 2), 16);
        if(!isNaN(byteVal)) key.push(byteVal);
    }
    // Pad key to 8 bytes if short
    while(key.length < 8) key.push(0);

    // Frame parsing
    frame = parseInt(f, 16); 
    if(isNaN(frame)) frame = 0;

    uiLog(`Key Loaded: 0x${hex.toUpperCase()}`, "data");
    uiLog(`Frame Counter: 0x${frame.toString(16).toUpperCase()}`, "data");

    // Perform the heavy lifting
    uiLog("Mixing Key and Frame into R1, R2, R3...", "info");
    keysetup(key, frame);
    
    uiLog("Running 114 cycles for Keystream generation...", "info");
    run(AtoB, BtoA);

    // Output results to terminal
    uiLog(`GENERATION COMPLETE.`, "success");
    
    // Format Keystreams for display
    let aTobStr = "";
    for (let i = 0; i < AtoB.length; i++) {
        aTobStr += AtoB[i].toString(16).padStart(2, '0').toUpperCase();
    }
    uiLog(`Keystream (A->B): 0x${aTobStr}`, "data");

    let bToaStr = "";
    for (let i = 0; i < BtoA.length; i++) {
        bToaStr += BtoA[i].toString(16).padStart(2, '0').toUpperCase();
    }
    uiLog(`Keystream (B->A): 0x${bToaStr}`, "data");

    // Update visual status
    const statusEl = document.getElementById("status-indicator");
    if(statusEl) statusEl.innerHTML = `STATUS: <span style="color:#10b981">ACTIVE</span>`;
}

// --- Conversion Helpers (Ascii <-> Hex) ---

function ascii_to_val(str) {
    var arr1 = [];
    for (var n = 0, l = str.length; n < l; n++) {
        var hex = Number(str.charCodeAt(n));
        arr1.push(hex);
    }
    return arr1;
}

function val_to_ascii(list) {
    return String.fromCharCode.apply(null, list);
}

function bytesToHex(bytes) {
    return bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join('');
}

function hexToBytes(hex) {
    let bytes = [];
    hex = hex.replace(/\s+/g, ''); // Clean spaces
    for (let c = 0; c < hex.length; c += 2) {
        bytes.push(parseInt(hex.substr(c, 2), 16));
    }
    return bytes;
}

// --- Encryption/Decryption Logic ---

// Encrypt: Text Input -> XOR -> Hex String Output
function encryptLogic(keyStream, message) {
    var plain = ascii_to_val(message);
    var cipherBytes = [];
    
    let limit = Math.min(plain.length, keyStream.length);
    
    for (let i = 0; i < limit; i++) {
        cipherBytes.push(plain[i] ^ keyStream[i]);
    }
    
    return bytesToHex(cipherBytes);
}

// Decrypt: Hex String Input -> XOR -> Text Output
function decryptLogic(keyStream, hexMessage) {
    var cipherBytes = hexToBytes(hexMessage);
    var plainBytes = [];
    
    let limit = Math.min(cipherBytes.length, keyStream.length);
    
    for (let i = 0; i < limit; i++) {
        plainBytes.push(cipherBytes[i] ^ keyStream[i]);
    }
    
    return val_to_ascii(plainBytes);
}

// --- Button Event Handlers ---

function generatekey(){
    var key = keyele.value.trim();
    var frame = frameele.value.trim();
    
    const consoleDisplay = document.getElementById('console-display');
    if(consoleDisplay) {
        consoleDisplay.innerHTML = '<div class="log-line"> <span class="cmd">></span> System reset. Starting new session...</div>';
    }

    if(key != "" && frame != ""){
        generateKeyLogic(key, frame);
    }
    else {
        alert("Please Enter Key and Frame!");
        uiLog("Error: Missing Key or Frame", "warn");
    }
}

function encryptu1() {
    var message = inpmessu1.value.trim();
    if (AtoB.length != 0 && message != "") {
        // User 1 Encrypts using AtoB stream
        var hexCipher = encryptLogic(AtoB, message);
        outmessu1.value = hexCipher;
        uiLog(`User 1 Encrypted: "${message}" -> ${hexCipher}`, "info");
    } else if (message == "") {
        alert("No message given!");
    } else {
        alert("Please generate a key first.");
    }
}

function decryptu1() {
    var hexMessage = inpmessu1.value.trim();
    if (BtoA.length != 0 && hexMessage != "") {
        // Decrypt using BtoA stream (Incoming from U2)
        // (Or AtoB if testing loopback, but strictly U1 receives via BtoA in standard model)
        // For simulation simplicity, we assume U1 receives what U2 sent (BtoA encrypted)
        var plain = decryptLogic(BtoA, hexMessage); 
        outmessu1.value = plain;
        uiLog(`User 1 Decrypted: ${hexMessage} -> "${plain}"`, "success");
    } else if (hexMessage == "") {
        alert("No message given!");
    } else {
        alert("Please generate a key first.");
    }
}

function encryptu2() {
    var message = inpmessu2.value.trim();
    if (BtoA.length != 0 && message != "") {
        // User 2 Encrypts using BtoA stream
        var hexCipher = encryptLogic(BtoA, message);
        outmessu2.value = hexCipher;
        uiLog(`User 2 Encrypted: "${message}" -> ${hexCipher}`, "info");
    } else if (message == "") {
        alert("No message given!");
    } else {
        alert("Please generate a key first.");
    }
}

function decryptu2() {
    var hexMessage = inpmessu2.value.trim();
    if (AtoB.length != 0 && hexMessage != "") {
        // User 2 Decrypts using AtoB stream (Incoming from U1)
        var plain = decryptLogic(AtoB, hexMessage);
        outmessu2.value = plain;
        uiLog(`User 2 Decrypted: ${hexMessage} -> "${plain}"`, "success");
    } else if (hexMessage == "") {
        alert("No message given!");
    } else {
        alert("Please generate a key first.");
    }
}