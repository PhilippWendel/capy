const std = @import("std");
const backend = @import("../backend.zig");
const internal = @import("../internal.zig");
const Size = @import("../data.zig").Size;
const Atom = @import("../data.zig").Atom;
const Widget = @import("../widget.zig").Widget;

/// `Alignment` is a component used to align the enclosed component within the space
/// it's been given.
/// Using its default values, `Alignment` will center the enclosed component.
/// ```
/// capy.Alignment(.{}, capy.button(.{ .label = "Hi" }))
/// ```
/// will put out a centered button.
///
/// For more information, you can find a playground of the component on
/// [the website](https://capy-ui.org/docs/api-reference/components/align)
pub const Alignment = struct {
    pub usingnamespace @import("../internal.zig").All(Alignment);

    peer: ?backend.Container = null,
    widget_data: Alignment.WidgetData = .{},

    // TODO: when the child property changes, really change it on the Alignment component's peer
    child: Atom(*Widget) = Atom(*Widget).of(undefined),
    relayouting: std.atomic.Value(bool) = std.atomic.Value(bool).init(false),
    /// The horizontal alignment of the child component, from 0 (left) to 1 (right).
    x: Atom(f32) = Atom(f32).of(0.5),
    /// The vertical alignment of the child component, from 0 (top) to 1 (bottom).
    y: Atom(f32) = Atom(f32).of(0.5),

    pub fn init(config: Alignment.Config) !Alignment {
        var component = Alignment.init_events(Alignment{});
        internal.applyConfigStruct(&component, config);
        try component.addResizeHandler(&onResize);
        component.child.get().ref();

        return component;
    }

    fn onResize(self: *Alignment, _: Size) !void {
        self.relayout();
    }

    pub fn getChild(self: *Alignment, name: []const u8) ?*Widget {
        if (self.child.get().name.*.get()) |child_name| {
            if (std.mem.eql(u8, child_name, name)) {
                return self.child.get();
            }
        }
        return null;
    }

    /// When alignX or alignY is changed, this will trigger a parent relayout
    fn alignChanged(_: f32, userdata: ?*anyopaque) void {
        const self: *Alignment = @ptrCast(@alignCast(userdata));
        self.relayout();
    }

    pub fn _showWidget(widget: *Widget, self: *Alignment) !void {
        self.child.get().parent = widget;
    }

    pub fn show(self: *Alignment) !void {
        if (self.peer == null) {
            var peer = try backend.Container.create();
            self.peer = peer;

            _ = try self.x.addChangeListener(.{ .function = alignChanged, .userdata = self });
            _ = try self.y.addChangeListener(.{ .function = alignChanged, .userdata = self });

            try self.child.get().show();
            peer.add(self.child.get().peer.?);

            try self.setupEvents();
        }
    }

    pub fn relayout(self: *Alignment) void {
        if (self.relayouting.load(.seq_cst) == true) return;
        if (self.peer) |peer| {
            self.relayouting.store(true, .seq_cst);
            defer self.relayouting.store(false, .seq_cst);

            const available = Size{ .width = @as(u32, @intCast(peer.getWidth())), .height = @as(u32, @intCast(peer.getHeight())) };

            const alignX = self.x.get();
            const alignY = self.y.get();

            if (self.child.get().peer) |widgetPeer| {
                const preferredSize = self.child.get().getPreferredSize(available);
                const finalSize = Size.intersect(preferredSize, available);

                const x = @as(u32, @intFromFloat(alignX * @as(f32, @floatFromInt(available.width -| finalSize.width))));
                const y = @as(u32, @intFromFloat(alignY * @as(f32, @floatFromInt(available.height -| finalSize.height))));

                peer.move(widgetPeer, x, y);
                peer.resize(widgetPeer, finalSize.width, finalSize.height);
            }
        }
    }

    pub fn getPreferredSize(self: *Alignment, available: Size) Size {
        return self.child.get().getPreferredSize(available);
    }

    pub fn cloneImpl(self: *Alignment) !*Alignment {
        _ = self;
        // const widget_clone = try self.child.get().clone();
        const ptr = try internal.lasting_allocator.create(Alignment);
        // const component = try Alignment.init(.{ .x = self.x.get(), .y = self.y.get() }, widget_clone);
        // ptr.* = component;
        return ptr;
    }

    pub fn _deinit(self: *Alignment) void {
        self.child.get().unref();
    }
};

pub fn alignment(opts: Alignment.Config, child: anytype) anyerror!*Alignment {
    const element =
        if (comptime internal.isErrorUnion(@TypeOf(child)))
        try child
    else
        child;

    var options = opts;
    options.child = internal.getWidgetFrom(element);
    return Alignment.alloc(options);
}
