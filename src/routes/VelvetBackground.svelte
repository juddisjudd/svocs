<script lang="ts">
	import { browser } from '$app/environment';

	let canvas: HTMLCanvasElement | undefined = $state();

	const VERT_SRC = `
attribute vec2 a_position;
void main() {
	gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

	// Domain-warped fbm (fractal Brownian motion) over a 2D simplex noise
	// field — the classic Inigo Quilez "warp" technique: feed one fbm's
	// output back in as an offset into a second, then a third. That's what
	// gives the result its directionless, turbulent mottling rather than
	// obviously-repeating noise bands, which is what actually reads as
	// fabric grain instead of a generic gradient.
	const FRAG_SRC = `
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;
uniform float u_mouseActive;
uniform vec3 u_colorDeep;
uniform vec3 u_colorMid;
uniform vec3 u_colorSheen;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
	const vec4 C = vec4(0.211324865405187, 0.366025403784439,
	                    -0.577350269189626, 0.024390243902439);
	vec2 i  = floor(v + dot(v, C.yy));
	vec2 x0 = v - i + dot(i, C.xx);
	vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
	vec4 x12 = x0.xyxy + C.xxzz;
	x12.xy -= i1;
	i = mod289(i);
	vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
	vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
	m = m * m;
	m = m * m;
	vec3 x = 2.0 * fract(p * C.www) - 1.0;
	vec3 h = abs(x) - 0.5;
	vec3 ox = floor(x + 0.5);
	vec3 a0 = x - ox;
	m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
	vec3 g;
	g.x = a0.x * x0.x + h.x * x0.y;
	g.yz = a0.yz * x12.xz + h.yz * x12.yw;
	return 130.0 * dot(m, g);
}

float fbm(vec2 p) {
	float value = 0.0;
	float amplitude = 0.5;
	for (int i = 0; i < 5; i++) {
		value += amplitude * snoise(p);
		p *= 2.02;
		amplitude *= 0.5;
	}
	return value;
}

void main() {
	vec2 st = gl_FragCoord.xy / u_resolution.xy;
	float aspect = u_resolution.x / u_resolution.y;
	st.x *= aspect;

	vec2 mouseSt = u_mouse;
	mouseSt.x *= aspect;
	float mouseInfluence = smoothstep(0.6, 0.0, distance(st, mouseSt)) * u_mouseActive;

	float t = u_time * 0.035;

	vec2 q = vec2(fbm(st + t), fbm(st + vec2(5.2, 1.3) + t));
	vec2 r = vec2(
		fbm(st + 2.2 * q + vec2(1.7, 9.2) - t * 1.3 + mouseInfluence * 0.5),
		fbm(st + 2.2 * q + vec2(8.3, 2.8) + t * 1.1 - mouseInfluence * 0.5)
	);
	float n = fbm(st + 2.6 * r);
	float grain = clamp(n * 0.5 + 0.5, 0.0, 1.0);

	vec3 color = mix(u_colorDeep, u_colorMid, smoothstep(0.05, 0.65, grain));

	float sheen = smoothstep(0.64, 0.9, grain);
	sheen += mouseInfluence * smoothstep(0.5, 0.88, grain) * 0.55;
	color = mix(color, u_colorSheen, clamp(sheen, 0.0, 0.5));

	// Wide, shallow falloff — most of the canvas stays clearly visible at
	// rest, mouse hover isn't the only way to see the texture. Only the
	// far corners recede toward colorDeep.
	vec2 center = vec2(aspect * 0.5, 0.42);
	float vignette = smoothstep(1.9, 0.2, distance(st, center));
	color = mix(u_colorDeep, color, mix(0.62, 1.0, vignette));

	gl_FragColor = vec4(color, 1.0);
}
`;

	$effect(() => {
		if (!browser || !canvas) return;

		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		const gl = canvas.getContext('webgl', {
			alpha: false,
			antialias: false,
			powerPreference: 'low-power'
		});
		if (!gl) return;

		function compile(type: number, source: string): WebGLShader | null {
			const shader = gl!.createShader(type);
			if (!shader) return null;
			gl!.shaderSource(shader, source);
			gl!.compileShader(shader);
			if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) {
				gl!.deleteShader(shader);
				return null;
			}
			return shader;
		}

		const vertShader = compile(gl.VERTEX_SHADER, VERT_SRC);
		const fragShader = compile(gl.FRAGMENT_SHADER, FRAG_SRC);
		if (!vertShader || !fragShader) return;

		const program = gl.createProgram();
		if (!program) return;
		gl.attachShader(program, vertShader);
		gl.attachShader(program, fragShader);
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
		gl.useProgram(program);

		// One oversized triangle covering the viewport is cheaper than a
		// quad (2 triangles, 6 verts, a diagonal seam) — standard
		// full-screen-shader trick, no seam because the extra area past
		// clip space just gets clipped.
		const positionBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
		const positionLoc = gl.getAttribLocation(program, 'a_position');
		gl.enableVertexAttribArray(positionLoc);
		gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

		const uResolution = gl.getUniformLocation(program, 'u_resolution');
		const uTime = gl.getUniformLocation(program, 'u_time');
		const uMouse = gl.getUniformLocation(program, 'u_mouse');
		const uMouseActive = gl.getUniformLocation(program, 'u_mouseActive');
		const uColorDeep = gl.getUniformLocation(program, 'u_colorDeep');
		const uColorMid = gl.getUniformLocation(program, 'u_colorMid');
		const uColorSheen = gl.getUniformLocation(program, 'u_colorSheen');

		// getComputedStyle().getPropertyValue('--foo') returns a custom
		// property's *literal specified text* — fine for a plain hex
		// literal, but --glow-a/--accent-soft are color-mix() expressions
		// (derived from --accent so a custom brand color stays coordinated
		// instead of leaving the glow stuck ember-colored). Resolving a
		// function value requires assigning it to a real color property on
		// a probe element and reading that back, since only ordinary
		// properties get resolved to rgb(...) by getComputedStyle.
		const probe = document.createElement('div');
		probe.style.cssText = 'position:absolute; width:0; height:0; visibility:hidden;';
		document.body.appendChild(probe);

		function resolveColorVar(
			varName: string,
			fallback: [number, number, number]
		): [number, number, number] {
			probe.style.color = `var(${varName})`;
			const resolved = getComputedStyle(probe).color;
			const nums = resolved.match(/[\d.]+/g);
			if (!nums || nums.length < 3) return fallback;
			// A color-mix() result serializes as color(srgb r g b) — already
			// 0-1 normalized — while a plain literal serializes as the legacy
			// rgb(r, g, b) — 0-255. Dividing the former by 255 collapses
			// everything toward black, so the two formats need branching.
			return resolved.startsWith('color(')
				? [Number(nums[0]), Number(nums[1]), Number(nums[2])]
				: [Number(nums[0]) / 255, Number(nums[1]) / 255, Number(nums[2]) / 255];
		}

		// The dark-theme brand palette already has a near-black base and a
		// warm ember-brown "glow" tone (--bg / --glow-a) — reused here
		// rather than hardcoding a separate velvet palette, so this stays
		// in sync with the site's actual colors (including light mode and
		// any custom --accent) instead of drifting into its own thing.
		let colorDeep: [number, number, number] = [0, 0, 0];
		let colorMid: [number, number, number] = [0, 0, 0];
		let colorSheen: [number, number, number] = [1, 1, 1];

		function readThemeColors() {
			colorDeep = resolveColorVar('--bg', [0, 0, 0]);
			colorMid = resolveColorVar('--glow-a', [0.078, 0.035, 0.012]);
			colorSheen = resolveColorVar('--accent-soft', [1, 0.416, 0.22]);
		}
		readThemeColors();

		let mouseTarget = { x: 0.5, y: 0.34 };
		let mouseCurrent = { x: 0.5, y: 0.34 };
		let mouseActive = 0;
		let mouseActiveTarget = 0;

		function onPointerMove(event: PointerEvent) {
			const rect = canvas!.getBoundingClientRect();
			mouseTarget = {
				x: (event.clientX - rect.left) / rect.width,
				y: 1 - (event.clientY - rect.top) / rect.height
			};
			mouseActiveTarget = 1;
		}

		function onPointerLeave() {
			mouseActiveTarget = 0;
		}

		// canvas itself is pointer-events:none (it must never intercept
		// clicks on the hero's real buttons/links), so mouse tracking
		// listens on the section instead — pointermove still bubbles up
		// through it from anything the cursor is actually over.
		const section = canvas.closest('.hero') ?? canvas;
		if (!reducedMotion) {
			section.addEventListener('pointermove', onPointerMove as EventListener);
			section.addEventListener('pointerleave', onPointerLeave);
		}

		let width = 0;
		let height = 0;

		function resize() {
			const rect = canvas!.getBoundingClientRect();
			const dpr = Math.min(window.devicePixelRatio || 1, 2);
			width = Math.max(1, Math.round(rect.width * dpr));
			height = Math.max(1, Math.round(rect.height * dpr));
			canvas!.width = width;
			canvas!.height = height;
			gl!.viewport(0, 0, width, height);
		}

		resize();
		const resizeObserver = new ResizeObserver(resize);
		resizeObserver.observe(canvas);

		const themeObserver = new MutationObserver(readThemeColors);
		themeObserver.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['data-theme']
		});

		let raf = 0;
		const start = performance.now();

		function frame(now: number) {
			mouseCurrent.x += (mouseTarget.x - mouseCurrent.x) * 0.08;
			mouseCurrent.y += (mouseTarget.y - mouseCurrent.y) * 0.08;
			mouseActive += (mouseActiveTarget - mouseActive) * 0.06;

			gl!.uniform2f(uResolution, width, height);
			gl!.uniform1f(uTime, reducedMotion ? 0 : (now - start) / 1000);
			gl!.uniform2f(uMouse, mouseCurrent.x, mouseCurrent.y);
			gl!.uniform1f(uMouseActive, mouseActive);
			gl!.uniform3f(uColorDeep, ...colorDeep);
			gl!.uniform3f(uColorMid, ...colorMid);
			gl!.uniform3f(uColorSheen, ...colorSheen);
			gl!.drawArrays(gl!.TRIANGLES, 0, 3);

			if (!reducedMotion) {
				raf = requestAnimationFrame(frame);
			}
		}

		if (reducedMotion) {
			frame(performance.now());
		} else {
			raf = requestAnimationFrame(frame);
		}

		return () => {
			cancelAnimationFrame(raf);
			resizeObserver.disconnect();
			themeObserver.disconnect();
			section.removeEventListener('pointermove', onPointerMove as EventListener);
			section.removeEventListener('pointerleave', onPointerLeave);
			probe.remove();
			gl!.deleteProgram(program);
			gl!.deleteShader(vertShader);
			gl!.deleteShader(fragShader);
			gl!.deleteBuffer(positionBuffer);
		};
	});
</script>

<canvas bind:this={canvas} class="velvet-canvas" aria-hidden="true"></canvas>

<style>
	.velvet-canvas {
		position: absolute;
		inset: -1.5rem 0 auto;
		height: 44rem;
		width: 100%;
		display: block;
		pointer-events: none;
		/* Percentage-based (not a fixed rem radius) so the feather scales with
		   the container at any viewport width — a fixed-size ellipse reads as
		   a hard-edged blob on wide screens once it doesn't reach fully
		   transparent before the box edge. Tighter than a full-bleed wash on
		   purpose: the visible core roughly tracks the hero's actual text
		   column (.lede maxes out at 42rem) rather than spreading edge to
		   edge, with a long fade tail so it still dissolves smoothly rather
		   than clipping. */
		mask-image: radial-gradient(46% 70% at 50% 26%, black 20%, transparent 90%);
		-webkit-mask-image: radial-gradient(46% 70% at 50% 26%, black 20%, transparent 90%);
		opacity: 0.95;
	}

	@media (max-width: 640px) {
		.velvet-canvas {
			height: 36rem;
		}
	}
</style>
