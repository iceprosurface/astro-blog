import { Application, Container, Graphics, Text } from 'pixi.js';

export class PixiRenderer {
    public app: Application | null = null;
    public linkContainer: Container<Graphics> | null = null;
    public nodeContainer: Container<Graphics> | null = null;
    public labelContainer: Container<Text> | null = null;

    async init(container: HTMLElement) {
        const width = container.offsetWidth;
        const height = container.offsetHeight;
        const dpr = window.devicePixelRatio || 1;

        const app = new Application();
        await app.init({
            width,
            height,
            antialias: true,
            autoStart: true,
            resolution: dpr,
            autoDensity: true,
            backgroundAlpha: 0,
            resizeTo: container,
        });

        if (container.firstChild) {
            container.innerHTML = '';
        }
        container.appendChild(app.canvas);
        app.canvas.style.width = "100%";
        app.canvas.style.height = "100%";

        const stage = app.stage;
        stage.interactive = false;

        // Center stage initially? Standard d3-zoom usually handles transforms on a container or the stage.
        // For simplicity with d3-zoom, we often transform the stage.
        // stage.position.set(width / 2, height / 2); // Removed to fix double-centering issue

        // Containers for layers
        this.linkContainer = new Container<Graphics>({ zIndex: 1 });
        this.nodeContainer = new Container<Graphics>({ zIndex: 2 });
        this.labelContainer = new Container<Text>({ zIndex: 3 });
        stage.addChild(this.linkContainer, this.nodeContainer, this.labelContainer);

        this.app = app;
    }

    destroy() {
        if (this.app) {
            this.app.destroy(true, { children: true, texture: true });
            this.app = null;
        }
    }

    render() {
        if (this.app) {
            this.app.renderer.render(this.app.stage);
        }
    }
}
