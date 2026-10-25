// Step one of the move to Astro: the site's own scripts still find the animation libraries where they always did, on
// window, and run as they were. They become typed modules that import what they use, one by one, and this goes.
import barba from "@barba/core";
import barbaPrefetch from "@barba/prefetch";
import { gsap } from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { InertiaPlugin } from "gsap/InertiaPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Lenis from "lenis";
import Smooothy from "smooothy";

Object.assign(window, { gsap, ScrollTrigger, SplitText, CustomEase, InertiaPlugin, DrawSVGPlugin, Lenis, barba, barbaPrefetch, Smooothy });
