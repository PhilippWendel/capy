let obj = null;
let domObjects = [];
let canvasContexts = [];
let pendingEvents = [];
let events = [];
let executeProgram = true;

function pushEvent(evt) {
	const eventId = events.push(evt);
	pendingEvents.push(eventId - 1);
}

function readString(addr, len) {
	addr = addr >>> 0; // convert from i32 to u32
	len = len >>> 0;

	let utf8Decoder = new TextDecoder();
	let view = new Uint8Array(obj.instance.exports.memory.buffer);
	// console.debug("read string @ " + addr + " for " + len + " bytes");
	
	return utf8Decoder.decode(view.slice(addr, addr + len));
}
const importObj = {
	env: {
		jsPrint: function(arg, len) {
			console.log(readString(arg, len));
		},
		jsCreateElement: function(name, nameLen) {
			const elem = document.createElement(readString(name, nameLen));
			const idx = domObjects.push(elem) - 1;

			elem.style.position = "absolute";
			elem.addEventListener("click", function(e) {
				pushEvent({
					type: 1,
					target: idx
				});
			});
			elem.addEventListener("change", function(e) {
				pushEvent({
					type: 2,
					target: idx
				});
			});
			return idx;
		},
		appendElement: function(parent, child) {
			domObjects[parent].appendChild(domObjects[child]);
		},
		setRoot: function(root) {
			document.querySelector("#application").appendChild(domObjects[root]);
			domObjects[root].style.width  = "100%";
			domObjects[root].style.height = "100%";
		},
		setText: function(element, textPtr, textLen) {
			const elem = domObjects[element];
			if (elem.nodeName === "INPUT") {
				elem.value = readString(textPtr, textLen);
			} else {
				elem.innerText = readString(textPtr, textLen);
			}
		},
		getTextLen: function(element) {
			const elem = domObjects[element];
			let text = "";
			if (elem.nodeName === "INPUT") text = elem.value;
			else text = elem.innerText;
			const length = new TextEncoder().encode(text).length;
			//console.log(text.length + " <= " + length);
			return length;
		},
		getText: function(element, textPtr) {
			const elem = domObjects[element];
			let text = "";
			if (elem.nodeName === "INPUT") text = elem.value;
			else text = elem.innerText;

			const length = new TextEncoder().encode(text).length;

			let view = new Uint8Array(obj.instance.exports.memory.buffer);
			for (let i = 0; i < length; i++) {
				view[textPtr + i] = text.codePointAt(i);
			}
		},
		setPos: function(element, x, y) {
			domObjects[element].style.transform = "translate(" + x + "px, " + y + "px)";
		},
		setSize: function(element, w, h) {
			domObjects[element].style.width  = w + "px";
			domObjects[element].style.height = h + "px";
		},
		getWidth: function(element) {
			return domObjects[element].clientWidth;
		},
		getHeight: function(element) {
			return domObjects[element].clientHeight;
		},
		now: function() {
			return Date.now();
		},
		hasEvent: function() {
			return pendingEvents.length > 0;
		},
		popEvent: function() {
			if (pendingEvents.length > 0) {
				return pendingEvents.shift();
			} else {
				console.error("Popping event even though none is available!");
			}
		},
		getEventType: function(event) {
			return events[event].type;
		},
		getEventTarget: function(event) {
			if (events[event].target === undefined) {
				console.error("Tried getting the target of a global event");
			}
			return events[event].target;
		},

		// Canvas
		openContext: function(element) {
			const canvas = domObjects[element];
			canvas.width = canvas.clientWidth;
			canvas.height = canvas.clientHeight;
			const ctx = canvas.getContext("2d");
			ctx.lineWidth = 2.5;
			ctx.beginPath();
			return canvasContexts.push(ctx) - 1;
		},
		setColor: function(ctx, r, g, b, a) {
			canvasContexts[ctx].fillStyle = "rgba(" + r + "," + g + "," + b + "," + a + ")";
			canvasContexts[ctx].strokeStyle = canvasContexts[ctx].fillStyle;
		},
		rectPath: function(ctx, x, y, w, h) {
			canvasContexts[ctx].rect(x, y, w, h);
		},
		moveTo: function(ctx, x, y) {
			canvasContexts[ctx].moveTo(x, y);
		},
		lineTo: function(ctx, x, y) {
			canvasContexts[ctx].lineTo(x, y);
		},
		fill: function(ctx) {
			canvasContexts[ctx].fill();
			canvasContexts[ctx].beginPath();
		},
		stroke: function(ctx) {
			canvasContexts[ctx].stroke();
			canvasContexts[ctx].beginPath();
		},

		stopExecution: function() {
			executeProgram = false;
		},
	}
};

(async function() {
	obj = await WebAssembly.instantiateStreaming(fetch("zig-app.wasm"), importObj);
	obj.instance.exports._start();

	// TODO: when we're in blocking mode, avoid updating so often
	function update() {
		if (executeProgram) {
			obj.instance.exports._zgtContinue();
		} else {
			// TODO: clearInterval
		}
	}
	setInterval(update, 32);

	window.onresize = function() {
		pushEvent({ type: 0 });
	};
	window.onresize(); // call resize handler atleast once, to setup layout
})();
