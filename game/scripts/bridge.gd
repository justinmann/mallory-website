extends Node
## Bridge — the ONLY script that talks to JavaScript / the surrounding web page.
##
## In the Godot editor (not a web build) every method no-ops, so you can still
## press Play and walk around for testing — you just won't get real books or
## be able to open them (that part needs the React app around it).
##
## On the web it speaks to the parent React page via window.postMessage:
##   React  -> game : { type:'mallory:setBooks', books:[...] }
##   game   -> React: { type:'mallory:ready' }
##                    { type:'mallory:openBook',     id }
##                    { type:'mallory:lecternMoved', id, pos:{x,y} }

signal books_received(books: Array)

var _cb: JavaScriptObject       # keep a reference or the JS callback gets garbage-collected
var _last_books: Array = []
var _have_books := false

func _ready() -> void:
	if not _is_web():
		return
	# 1) Make a callback the page can call, handing us the book list as JSON.
	_cb = JavaScriptBridge.create_callback(_on_books_from_js)
	var win := JavaScriptBridge.get_interface("window")
	win.__malloryOnBooks = _cb
	# 2) Listen for messages from the parent React page and forward book updates.
	JavaScriptBridge.eval("""
		window.addEventListener('message', function(e) {
			var d = e.data || {};
			if (d.type === 'mallory:setBooks' && window.__malloryOnBooks) {
				window.__malloryOnBooks(JSON.stringify(d.books || []));
			}
		});
	""", true)
	# 3) Tell the page we're alive and ready to receive books.
	_post("mallory:ready")

func _on_books_from_js(args: Array) -> void:
	var parsed: Variant = JSON.parse_string(String(args[0]))
	_last_books = parsed if parsed is Array else []
	_have_books = true
	books_received.emit(_last_books)

## Called by library.gd right after it connects, in case books arrived first.
func flush_buffered() -> void:
	if _have_books:
		books_received.emit(_last_books)

func emit_open_book(id: String) -> void:
	_post("mallory:openBook", {"id": id})

func emit_lectern_moved(id: String, x: float, y: float) -> void:
	_post("mallory:lecternMoved", {"id": id, "pos": {"x": x, "y": y}})

func _post(type: String, extra: Dictionary = {}) -> void:
	if not _is_web():
		return
	var payload := {"type": type}
	payload.merge(extra)
	# Same-origin iframe, so '*' is acceptable; tighten to the real origin if desired.
	JavaScriptBridge.eval("window.parent.postMessage(%s, '*');" % JSON.stringify(payload), true)

func _is_web() -> bool:
	return OS.has_feature("web")
