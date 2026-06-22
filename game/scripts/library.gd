extends Node2D
## Mallory's Library — the walkable, top-down room.
##
## Everything here is drawn in code (no art files yet), so it's easy to read and
## tweak while learning. The room, the player, and the book "lecterns" are all
## drawn each frame in _draw(). Movement and input are handled in _process/_input.
##
## It talks to the React app only through the Bridge autoload:
##   - Bridge.books_received  -> we (re)spawn lecterns
##   - Bridge.emit_open_book  -> React opens that book's page
##   - Bridge.emit_lectern_moved -> React saves the lectern's new position

const SPEED := 160.0          # player walk speed, pixels/second
const OPEN_RADIUS := 48.0     # how close you must stand to open a lectern
const WALL_FRAC := 0.42       # the back wall fills the top 42% of the room
const DESIGN := Vector2(960, 540)
const LECTERN_HALF := Vector2(14, 16)   # half-size of a lectern rectangle

# Lectern fill color per book.coverStyle.
const COVER := {
	"oxblood": Color("5e2b2b"),
	"forest": Color("273844"),
	"plain": Color("a8946a"),
}

var books: Array = []          # [{ id, title, coverStyle, pos:{x,y} }, ...]
var lectern_pos: Array = []    # Vector2 effective position per book (parallel to `books`)
var player_pos := Vector2.ZERO
var nearest := -1              # index of nearest openable lectern, or -1
var dragging := -1             # index of lectern being dragged, or -1
var joy_active := false        # mobile joystick currently held?
var joy_vec := Vector2.ZERO    # joystick direction, length 0..1
var _font: Font

func _ready() -> void:
	_font = ThemeDB.fallback_font
	# Start the player in the middle of the floor (below the back wall).
	player_pos = Vector2(DESIGN.x * 0.5, DESIGN.y * WALL_FRAC + (DESIGN.y * (1.0 - WALL_FRAC)) * 0.5)
	Bridge.books_received.connect(_on_books)
	Bridge.flush_buffered()    # in case books arrived before we connected

# ─── Books → lecterns ────────────────────────────────────────────────────────

func _on_books(list: Array) -> void:
	books = list
	_recompute_positions()
	queue_redraw()

func _recompute_positions() -> void:
	var slots := _compute_slots()
	lectern_pos.clear()
	for i in books.size():
		var p: Dictionary = books[i].get("pos", {})
		var v := Vector2(float(p.get("x", 0)), float(p.get("y", 0)))
		# Unplaced books (0,0) drop onto a visible grid slot.
		if v.x == 0.0 and v.y == 0.0:
			v = slots[i % slots.size()]
		lectern_pos.append(v)

func _compute_slots() -> Array:
	# A 4x2 grid across the floor (mirrors the old JS layout).
	var slots: Array = []
	var top := DESIGN.y * WALL_FRAC + 80.0
	var bottom := DESIGN.y - 90.0
	var cols := 4
	var rows := 2
	for r in rows:
		for c in cols:
			var x := DESIGN.x * 0.5 + (c - (cols - 1) / 2.0) * (DESIGN.x * 0.19)
			var y := top + r * ((bottom - top) / float(rows - 1))
			slots.append(Vector2(x, y))
	return slots

# ─── Per-frame update ────────────────────────────────────────────────────────

func _process(delta: float) -> void:
	# Movement: keyboard (desktop) or joystick (mobile).
	var dir := Vector2.ZERO
	if Input.is_physical_key_pressed(KEY_W) or Input.is_physical_key_pressed(KEY_UP): dir.y -= 1
	if Input.is_physical_key_pressed(KEY_S) or Input.is_physical_key_pressed(KEY_DOWN): dir.y += 1
	if Input.is_physical_key_pressed(KEY_A) or Input.is_physical_key_pressed(KEY_LEFT): dir.x -= 1
	if Input.is_physical_key_pressed(KEY_D) or Input.is_physical_key_pressed(KEY_RIGHT): dir.x += 1
	if dir != Vector2.ZERO:
		dir = dir.normalized()
	elif joy_vec.length() > 0.05:
		dir = joy_vec
	player_pos += dir * SPEED * delta
	player_pos.x = clampf(player_pos.x, 20.0, DESIGN.x - 20.0)
	player_pos.y = clampf(player_pos.y, DESIGN.y * WALL_FRAC + 10.0, DESIGN.y - 20.0)

	# A held mobile joystick follows the pointer.
	if joy_active:
		_update_joystick(get_global_mouse_position())

	# A grabbed lectern follows the pointer.
	if dragging >= 0 and dragging < lectern_pos.size():
		lectern_pos[dragging] = get_global_mouse_position()

	# Find the nearest openable lectern.
	nearest = -1
	var best := OPEN_RADIUS
	for i in lectern_pos.size():
		var d := player_pos.distance_to(lectern_pos[i])
		if d <= best:
			best = d
			nearest = i

	queue_redraw()

# ─── Input ───────────────────────────────────────────────────────────────────
# Touch is delivered as emulated mouse on web, so mouse handling covers both.

func _input(e: InputEvent) -> void:
	if e is InputEventKey and e.pressed and not e.echo and e.physical_keycode == KEY_E:
		_open_nearest()
	elif e is InputEventMouseButton and e.button_index == MOUSE_BUTTON_LEFT:
		if e.pressed:
			_pointer_down(get_global_mouse_position())
		else:
			_pointer_up()

func _pointer_down(world: Vector2) -> void:
	# Mobile controls take priority when shown.
	if _touch_ui():
		if world.distance_to(_joy_center()) <= 70.0:
			joy_active = true
			_update_joystick(world)
			return
		if world.distance_to(_btn_center()) <= 44.0:
			_open_nearest()
			return
	# Otherwise try to grab a lectern under the pointer.
	for i in lectern_pos.size():
		if world.distance_to(lectern_pos[i]) <= 26.0:
			dragging = i
			return

func _pointer_up() -> void:
	if joy_active:
		joy_active = false
		joy_vec = Vector2.ZERO
	if dragging >= 0 and dragging < lectern_pos.size():
		Bridge.emit_lectern_moved(_book_id(dragging), lectern_pos[dragging].x, lectern_pos[dragging].y)
		dragging = -1

func _update_joystick(world: Vector2) -> void:
	var R := 60.0
	var off := world - _joy_center()
	if off.length() > R:
		off = off.normalized() * R
	joy_vec = off / R

func _open_nearest() -> void:
	if nearest >= 0:
		Bridge.emit_open_book(_book_id(nearest))

func _book_id(i: int) -> String:
	return String(books[i].get("id", ""))

# ─── Drawing ───────────────────────────────────────────────────────────────────

func _draw() -> void:
	var w := DESIGN.x
	var h := DESIGN.y
	var wall_h := h * WALL_FRAC

	# Floor + back wall + baseboard.
	draw_rect(Rect2(0, 0, w, h), Color("2a1d12"))
	draw_rect(Rect2(0, 0, w, wall_h), Color("1a1510"))
	draw_rect(Rect2(0, wall_h - 6, w, 6), Color("0a0706"))

	# Candle glow pools on the floor.
	for cx in [w * 0.12, w * 0.88]:
		draw_circle(Vector2(cx, wall_h + 70.0), 95.0, Color(1.0, 0.78, 0.43, 0.08))

	# Two arched, moonlit windows (flattened ellipses).
	for wx in [w * 0.2, w * 0.8]:
		_draw_ellipse(Vector2(wx, wall_h * 0.45), Vector2(44, 80), Color("26323f"))

	# A bookshelf on the back wall.
	_draw_shelf(Vector2(w * 0.5, wall_h * 0.46), 180.0, minf(170.0, wall_h * 0.8))

	# Worn oxblood rug (flattened ellipse) on the floor.
	_draw_ellipse(Vector2(w * 0.5, wall_h + (h - wall_h) * 0.5), Vector2(255, 112), Color(0.37, 0.17, 0.17, 0.45))

	# Lecterns (one per book), tinted by cover style, with a brass border.
	for i in lectern_pos.size():
		var col: Color = COVER.get(books[i].get("coverStyle", "oxblood"), Color.WHITE)
		var p: Vector2 = lectern_pos[i]
		var r := Rect2(p - LECTERN_HALF, LECTERN_HALF * 2.0)
		draw_rect(r, col)
		draw_rect(r, Color("c9a24b"), false, 2.0)

	# Player.
	draw_rect(Rect2(player_pos - Vector2(12, 16), Vector2(24, 32)), Color("276e57"))

	# "E" prompt above the nearest lectern.
	if nearest >= 0 and _font:
		var lp: Vector2 = lectern_pos[nearest]
		draw_string(_font, lp + Vector2(-6, -34), "E", HORIZONTAL_ALIGNMENT_LEFT, -1, 20, Color("e8b84b"))

	# On-screen joystick + action button (touch devices only).
	if _touch_ui():
		var jc := _joy_center()
		draw_circle(jc, 60.0, Color(0.04, 0.03, 0.02, 0.55))
		draw_circle(jc + joy_vec * 60.0, 24.0, Color("c9a24b"))
		var bc := _btn_center()
		draw_circle(bc, 44.0, Color(0.04, 0.03, 0.02, 0.7))
		if _font:
			draw_string(_font, bc + Vector2(-6, 7), "E", HORIZONTAL_ALIGNMENT_LEFT, -1, 20, Color("e8b84b"))

func _draw_ellipse(center: Vector2, radii: Vector2, color: Color) -> void:
	draw_set_transform(center, 0.0, radii / 80.0)
	draw_circle(Vector2.ZERO, 80.0, color)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)

func _draw_shelf(center: Vector2, sw: float, sh: float) -> void:
	draw_rect(Rect2(center - Vector2(sw, sh) / 2.0, Vector2(sw, sh)), Color("120c08"))
	draw_rect(Rect2(center - Vector2(sw, sh) / 2.0, Vector2(sw, sh)), Color("080604"), false, 4.0)
	var palette := [Color("5e2b2b"), Color("27382c"), Color("3a2034"), Color("7a5a2a"), Color("2b4a44"), Color("6e3a3a")]
	var rows := 3
	var per := 8
	var row_h := (sh - 12.0) / rows
	var spine_w := (sw - 12.0) / per
	for r in rows:
		for i in per:
			var c: Color = palette[(r * per + i) % palette.size()]
			var spine_h := row_h - 8.0 - float((i * 7 + r * 13) % 16)
			var x := center.x - sw / 2.0 + 6.0 + i * spine_w
			var y := center.y - sh / 2.0 + 6.0 + r * row_h + (row_h - spine_h) - 4.0
			draw_rect(Rect2(x, y, spine_w - 2.0, spine_h), c)

# ─── Mobile control geometry ───────────────────────────────────────────────────

func _touch_ui() -> bool:
	return DisplayServer.is_touchscreen_available()

func _joy_center() -> Vector2:
	return Vector2(90, DESIGN.y - 90)

func _btn_center() -> Vector2:
	return Vector2(DESIGN.x - 80, DESIGN.y - 90)
