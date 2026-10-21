import { addPropertyControls, ControlType } from "framer"
import { useEffect, useRef, useState } from "react"

// Arrow states: hover shrinks the button and nudges the chevron the way it
// points; press squishes it, and releasing bounces it back past its resting
// size before it settles. Only enabled arrows react, hover only on devices
// that can hover, and motion is dropped for reduced-motion users.
const ARROW_CSS = `
.fc-track::-webkit-scrollbar{display:none}
.fc-drag,.fc-drag *{cursor:grab!important}
.fc-dragging,.fc-dragging *{cursor:grabbing!important}
.fc-arrow{
  --fc-base:1;
  background:var(--fc-fill);color:var(--fc-icon);
  transform:scale(var(--fc-base));
  transition:transform 220ms cubic-bezier(.2,.8,.2,1),background-color 200ms ease,color 200ms ease;
  -webkit-tap-highlight-color:transparent;outline:none;
}
.fc-ico{display:flex;transition:transform 220ms cubic-bezier(.2,.8,.2,1)}
@media (hover:hover) and (pointer:fine){
  .fc-arrow:not(:disabled):not([data-touch]):hover{
    --fc-base:var(--fc-hover-scale);
    background:var(--fc-hover-fill);color:var(--fc-hover-icon);
  }
  .fc-arrow:not(:disabled):not([data-touch]):hover .fc-ico{transform:translateX(var(--fc-nudge))}
}
.fc-arrow:not(:disabled):active{
  transform:scale(var(--fc-press-scale));transition-duration:90ms;
}
.fc-arrow.fc-bounce{animation:fc-bounce 460ms both}
@keyframes fc-bounce{
  0%{transform:scale(var(--fc-press-scale));animation-timing-function:cubic-bezier(.3,0,.2,1)}
  45%{transform:scale(calc(var(--fc-base) * (1 + var(--fc-bounce))));animation-timing-function:ease-in-out}
  72%{transform:scale(calc(var(--fc-base) * (1 - var(--fc-bounce) / 3)));animation-timing-function:ease-out}
  100%{transform:scale(var(--fc-base))}
}
.fc-arrow:focus-visible{box-shadow:0 0 0 3px var(--fc-fill),0 0 0 5px var(--fc-hover-fill)}
@media (prefers-reduced-motion:reduce){
  .fc-arrow,.fc-ico{transition:background-color 200ms ease,color 200ms ease}
  .fc-arrow.fc-bounce{animation:none}
  .fc-arrow:not(:disabled):hover,.fc-arrow:not(:disabled):active,
  .fc-arrow:not(:disabled):hover .fc-ico{transform:none}
}
`

/**
 * Carousel
 *
 * A horizontal carousel of components from your canvas, with prev/next
 * arrows underneath. Connect your cards to the "Items" list — each one
 * keeps its own size and design. Swipe on touch, drag with the mouse, or
 * use the arrows; cards snap into place.
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 1200
 */
export default function Carousel(props: any) {
    const {
        items = [],
        gap = 24,
        paddingLeft = 0,
        paddingRight = 0,
        align = "flex-start",
        draggable = true,
        showArrows = true,
        arrowAlign = "flex-start",
        arrowSpacing = 40,
        arrowGap = 10,
        arrowSize = 72,
        iconSize = 22,
        activeFill = "#ffffff",
        activeIcon = "#1b1b1b",
        inactiveFill = "#262626",
        inactiveIcon = "#ffffff",
        hoverFill = "#e8e8e8",
        hoverIcon = "#1b1b1b",
        hoverSize = 0.92,
        pressSize = 0.84,
        bounce = 0.08,
        style,
    } = props

    const cards = (items || []).filter(Boolean)

    // hover can only shrink; press always goes smaller than hover
    const hoverScale = Math.min(1, hoverSize)
    const pressScale = Math.min(hoverScale, pressSize)

    // Room for the bounce overshoot, so Framer doesn't clip the button at
    // the component's edge (taken out of the spacing above, so nothing moves)
    const growRoom = showArrows ? Math.ceil((arrowSize * bounce) / 2) + 2 : 0

    const trackRef = useRef<HTMLDivElement>(null)
    const cardRefs = useRef<any[]>([])
    // where an in-flight smooth scroll is heading, so fast clicks keep going
    const pending = useRef<any>(null)
    const settleTimer = useRef<any>(0)
    const [atStart, setAtStart] = useState(true)
    const [atEnd, setAtEnd] = useState(false)

    // which end(s) we're at, so the arrows can show their disabled look
    function updateEnds() {
        const el = trackRef.current
        if (!el) return
        // forget the in-flight target once scrolling settles (or is
        // interrupted by a wheel/touch scroll)
        clearTimeout(settleTimer.current)
        settleTimer.current = setTimeout(() => (pending.current = null), 150)
        setAtStart(el.scrollLeft <= 1)
        setAtEnd(el.scrollLeft >= el.scrollWidth - el.clientWidth - 1)
    }

    useEffect(() => {
        const el = trackRef.current
        if (!el) return
        updateEnds()
        el.addEventListener("scroll", updateEnds, { passive: true })
        const ro = new ResizeObserver(updateEnds)
        ro.observe(el)
        return () => {
            el.removeEventListener("scroll", updateEnds)
            ro.disconnect()
        }
    }, [cards.length])

    // Every scroll position a card can snap to (the last few cards can't
    // reach the left edge, so the very end counts as one stop)
    function stops() {
        const el = trackRef.current
        if (!el) return [0]
        const max = el.scrollWidth - el.clientWidth
        const list = cardRefs.current
            .slice(0, cards.length)
            .filter(Boolean)
            .map((c: HTMLElement) => Math.min(max, c.offsetLeft - paddingLeft))
        list.push(max)
        return Array.from(new Set(list.map((l) => Math.round(l)))).sort(
            (a, b) => a - b
        )
    }

    // Scroll so the previous/next card lines up with the left padding
    function go(dir: 1 | -1) {
        const el = trackRef.current
        if (!el) return
        const list = stops()
        const now = pending.current ?? el.scrollLeft
        const target =
            dir > 0
                ? list.find((l) => l > now + 2)
                : [...list].reverse().find((l) => l < now - 2)
        if (target === undefined) return
        pending.current = target
        clearTimeout(settleTimer.current)
        settleTimer.current = setTimeout(() => (pending.current = null), 1000)
        el.scrollTo({ left: target, behavior: "smooth" })
    }

    // Mouse drag (touch already swipes natively). Snapping is paused while
    // dragging and restored on release, which lets the browser snap smoothly.
    useEffect(() => {
        const el = trackRef.current
        if (!el || !draggable) return
        let down = false,
            startX = 0,
            startScroll = 0,
            moved = false
        const onDown = (e: PointerEvent) => {
            if (e.pointerType !== "mouse" || e.button !== 0) return
            pending.current = null
            el.classList.add("fc-dragging")
            down = true
            moved = false
            startX = e.clientX
            startScroll = el.scrollLeft
        }
        const onMove = (e: PointerEvent) => {
            if (!down) return
            const dx = e.clientX - startX
            if (!moved && Math.abs(dx) > 5) {
                moved = true
                el.style.scrollSnapType = "none"
            }
            if (moved) el.scrollLeft = startScroll - dx
        }
        const onUp = () => {
            if (!down) return
            down = false
            el.classList.remove("fc-dragging")
            if (moved) {
                // snap to the nearest card
                const lefts = stops()
                const now = el.scrollLeft
                const nearest = lefts.reduce(
                    (best, l) =>
                        Math.abs(l - now) < Math.abs(best - now) ? l : best,
                    lefts[0] ?? 0
                )
                el.scrollTo({ left: nearest, behavior: "smooth" })
                setTimeout(() => (el.style.scrollSnapType = ""), 400)
            }
        }
        // swallow the click that ends a drag so links in cards don't fire
        const onClick = (e: MouseEvent) => {
            if (moved) {
                e.preventDefault()
                e.stopPropagation()
                moved = false
            }
        }
        el.addEventListener("pointerdown", onDown)
        window.addEventListener("pointermove", onMove)
        window.addEventListener("pointerup", onUp)
        el.addEventListener("click", onClick, true)
        return () => {
            el.removeEventListener("pointerdown", onDown)
            window.removeEventListener("pointermove", onMove)
            window.removeEventListener("pointerup", onUp)
            el.removeEventListener("click", onClick, true)
        }
    }, [draggable, cards.length, paddingLeft])

    const arrow = (dir: 1 | -1, disabled: boolean) => (
        <button
            type="button"
            aria-label={dir > 0 ? "Next" : "Previous"}
            disabled={disabled}
            onClick={(e) => {
                // restart the release bounce (reflow so it replays on fast clicks)
                const b = e.currentTarget
                b.classList.remove("fc-bounce")
                void b.offsetWidth
                b.classList.add("fc-bounce")
                go(dir)
            }}
            onAnimationEnd={(e) => {
                if (e.animationName === "fc-bounce")
                    e.currentTarget.classList.remove("fc-bounce")
            }}
            onPointerDown={(e) => {
                const b = e.currentTarget
                // let the press squish show even mid-bounce
                b.classList.remove("fc-bounce")
                if (e.pointerType === "mouse") b.removeAttribute("data-touch")
                else b.setAttribute("data-touch", "")
            }}
            onPointerUp={(e) => {
                // on touch, don't leave the button looking focused/hovered
                if (e.pointerType !== "mouse") e.currentTarget.blur()
            }}
            className="fc-arrow"
            style={{
                // colors and scales live in CSS variables so the :hover
                // rules and the bounce keyframes can use them
                ["--fc-fill" as any]: disabled ? inactiveFill : activeFill,
                ["--fc-icon" as any]: disabled ? inactiveIcon : activeIcon,
                ["--fc-hover-fill" as any]: hoverFill,
                ["--fc-hover-icon" as any]: hoverIcon,
                ["--fc-hover-scale" as any]: hoverScale,
                ["--fc-press-scale" as any]: pressScale,
                ["--fc-bounce" as any]: bounce,
                ["--fc-nudge" as any]: `${dir * 3}px`,
                width: arrowSize,
                height: arrowSize,
                borderRadius: "50%",
                border: "none",
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: disabled ? "default" : "pointer",
            }}
        >
            <span className="fc-ico">
                <svg
                    width={iconSize}
                    height={iconSize}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.75}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ transform: dir < 0 ? "scaleX(-1)" : undefined }}
                >
                    <path d="M9 5l7 7-7 7" />
                </svg>
            </span>
        </button>
    )

    return (
        <div
            style={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
                gap: Math.max(0, arrowSpacing - growRoom),
                ...style,
            }}
        >
            <style>{ARROW_CSS}</style>
            <div
                ref={trackRef}
                className={draggable ? "fc-track fc-drag" : "fc-track"}
                style={{
                    display: "flex",
                    alignItems: align,
                    gap,
                    overflowX: "auto",
                    overflowY: "hidden",
                    scrollSnapType: "x mandatory",
                    scrollPaddingLeft: paddingLeft,
                    scrollPaddingRight: paddingRight,
                    paddingLeft,
                    paddingRight,
                    scrollbarWidth: "none",
                    position: "relative",
                    WebkitOverflowScrolling: "touch",
                }}
            >
                {cards.length === 0 ? (
                    <div
                        style={{
                            padding: 40,
                            color: "#888",
                            fontSize: 14,
                            fontFamily: "sans-serif",
                        }}
                    >
                        Connect your cards to "Items" in the properties panel.
                    </div>
                ) : (
                    cards.map((card: any, i: number) => (
                        <div
                            key={i}
                            ref={(el) => (cardRefs.current[i] = el)}
                            style={{
                                flex: "0 0 auto",
                                scrollSnapAlign: "start",
                                userSelect: "none",
                                WebkitUserSelect: "none",
                            }}
                        >
                            {card}
                        </div>
                    ))
                )}
                {/* zero-width snap point so the track can rest at its very end */}
                <div
                    aria-hidden
                    style={{
                        flex: "0 0 1px",
                        marginLeft: -gap - 1,
                        scrollSnapAlign: "end",
                    }}
                />
            </div>

            {showArrows && cards.length > 0 && (
                <div
                    style={{
                        display: "flex",
                        gap: arrowGap,
                        justifyContent: arrowAlign,
                        paddingTop: growRoom,
                        paddingBottom: growRoom,
                        paddingLeft,
                        paddingRight,
                    }}
                >
                    {arrow(-1, atStart)}
                    {arrow(1, atEnd)}
                </div>
            )}
        </div>
    )
}

addPropertyControls(Carousel, {
    items: {
        type: ControlType.Array,
        title: "Items",
        control: { type: ControlType.ComponentInstance },
        defaultValue: [],
    },
    gap: {
        type: ControlType.Number,
        title: "Gap",
        defaultValue: 24,
        min: 0,
        max: 200,
        unit: "px",
    },
    paddingLeft: {
        type: ControlType.Number,
        title: "Padding left",
        defaultValue: 0,
        min: 0,
        max: 400,
        unit: "px",
    },
    paddingRight: {
        type: ControlType.Number,
        title: "Padding right",
        defaultValue: 0,
        min: 0,
        max: 400,
        unit: "px",
    },
    align: {
        type: ControlType.Enum,
        title: "Card align",
        options: ["flex-start", "center", "flex-end", "stretch"],
        optionTitles: ["Top", "Center", "Bottom", "Stretch"],
        defaultValue: "flex-start",
    },
    draggable: {
        type: ControlType.Boolean,
        title: "Mouse drag",
        defaultValue: true,
        enabledTitle: "On",
        disabledTitle: "Off",
    },
    showArrows: {
        type: ControlType.Boolean,
        title: "Arrows",
        defaultValue: true,
        enabledTitle: "Show",
        disabledTitle: "Hide",
    },
    arrowAlign: {
        type: ControlType.Enum,
        title: "Arrow align",
        options: ["flex-start", "center", "flex-end"],
        optionTitles: ["Left", "Center", "Right"],
        defaultValue: "flex-start",
        displaySegmentedControl: true,
        hidden: (p: any) => !p.showArrows,
    },
    arrowSpacing: {
        type: ControlType.Number,
        title: "Arrow spacing",
        description: "Space between the cards and the arrows",
        defaultValue: 40,
        min: 0,
        max: 200,
        unit: "px",
        hidden: (p: any) => !p.showArrows,
    },
    arrowGap: {
        type: ControlType.Number,
        title: "Arrow gap",
        defaultValue: 10,
        min: 0,
        max: 100,
        unit: "px",
        hidden: (p: any) => !p.showArrows,
    },
    arrowSize: {
        type: ControlType.Number,
        title: "Arrow size",
        defaultValue: 72,
        min: 24,
        max: 160,
        unit: "px",
        hidden: (p: any) => !p.showArrows,
    },
    iconSize: {
        type: ControlType.Number,
        title: "Icon size",
        defaultValue: 22,
        min: 8,
        max: 80,
        unit: "px",
        hidden: (p: any) => !p.showArrows,
    },
    activeFill: {
        type: ControlType.Color,
        title: "Active fill",
        defaultValue: "#ffffff",
        hidden: (p: any) => !p.showArrows,
    },
    activeIcon: {
        type: ControlType.Color,
        title: "Active icon",
        defaultValue: "#1b1b1b",
        hidden: (p: any) => !p.showArrows,
    },
    inactiveFill: {
        type: ControlType.Color,
        title: "Inactive fill",
        defaultValue: "#262626",
        hidden: (p: any) => !p.showArrows,
    },
    inactiveIcon: {
        type: ControlType.Color,
        title: "Inactive icon",
        defaultValue: "#ffffff",
        hidden: (p: any) => !p.showArrows,
    },
    hoverFill: {
        type: ControlType.Color,
        title: "Hover fill",
        defaultValue: "#e8e8e8",
        hidden: (p: any) => !p.showArrows,
    },
    hoverIcon: {
        type: ControlType.Color,
        title: "Hover icon",
        defaultValue: "#1b1b1b",
        hidden: (p: any) => !p.showArrows,
    },
    hoverSize: {
        type: ControlType.Number,
        title: "Hover size",
        description: "How small the arrow gets on hover (1 = no change)",
        defaultValue: 0.92,
        min: 0.7,
        max: 1,
        step: 0.01,
        hidden: (p: any) => !p.showArrows,
    },
    pressSize: {
        type: ControlType.Number,
        title: "Press size",
        description: "How small it squishes while clicked",
        defaultValue: 0.84,
        min: 0.6,
        max: 1,
        step: 0.01,
        hidden: (p: any) => !p.showArrows,
    },
    bounce: {
        type: ControlType.Number,
        title: "Bounce",
        description: "How far it springs past its size after a click",
        defaultValue: 0.08,
        min: 0,
        max: 0.25,
        step: 0.01,
        hidden: (p: any) => !p.showArrows,
    },
})
