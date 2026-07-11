"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const node_server_1 = require("@hono/node-server");
const neovim_1 = require("neovim");
const markdown_it_1 = __importDefault(require("markdown-it"));
const highlight_js_1 = __importDefault(require("highlight.js"));
const markdown_it_texmath_1 = __importDefault(require("markdown-it-texmath"));
const katex_1 = __importDefault(require("katex"));
const serve_static_1 = require("@hono/node-server/serve-static");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const DIST_DIR = path_1.default.resolve(__dirname, "..");
const md = new markdown_it_1.default({
    html: true,
    highlight(str, lang) {
        if (lang && highlight_js_1.default.getLanguage(lang)) {
            return `<pre><code class="hljs">${highlight_js_1.default.highlight(str, { language: lang }).value}</code></pre>`;
        }
        return `<pre><code class="hljs">${md.utils.escapeHtml(str)}</code></pre>`;
    }
});
md.use(markdown_it_texmath_1.default, {
    engine: katex_1.default,
    delimiters: "dollars"
});
let TestPlugin = class TestPlugin {
    constructor(nvim) {
        this.nvim = nvim;
        this.markdown = "";
        this.launched = false;
    }
    async update_i() {
        if (this.launched) {
            const lines = (await this.nvim.buffer.lines).join("\n");
            this.markdown = lines;
        }
    }
    async update() {
        if (this.launched) {
            const lines = (await this.nvim.buffer.lines).join("\n");
            this.markdown = lines;
        }
    }
    async launch() {
        this.app = new hono_1.Hono();
        this.app.use("/dist/*", (0, serve_static_1.serveStatic)({ root: DIST_DIR }));
        this.app.get("/update", (c) => {
            return c.text(md.render(convertImagePath(this.markdown)));
        });
        this.app.get("/local-file", async (c) => {
            const filepath = c.req.query("path");
            if (!filepath) {
                return c.text("not found", 404);
            }
            try {
                const file = fs_1.default.readFileSync(filepath);
                const ext = path_1.default.extname(filepath);
                const mime = {
                    ".png": "image/png",
                    ".jpg": "image/jpeg",
                    ".jpeg": "image/jpeg",
                    ".gif": "image/gif",
                    ".webp": "image/webp",
                    ".svg": "image/svg+xml",
                };
                return new Response(file, {
                    headers: {
                        "Content-Type": mime[ext] ?? "application/octet-stream",
                    },
                });
            }
            catch {
                return c.text("file not found", 404);
            }
        });
        this.app.get("/show", (c) => {
            return c.html(`
<html>
  <head>
    <link rel="stylesheet" href="/dist/katex.min.css">
    <link rel="stylesheet" href="/dist/github-dark.css">
    <link rel="stylesheet" href="/dist/custom.css">
    <title>Markdown</title>
  </head>
  <body>
    <div id="app">
    </div>
    <script>
      const app=document.getElementById("app");
      setInterval(async()=>{
        const response=await fetch("http://localhost:3456/update");
        const text=await response.text();
        app.innerHTML=text;
      },100);
    </script>
  </body>
</html>`);
        });
        (0, node_server_1.serve)({ fetch: this.app.fetch, port: 3456, hostname: "0.0.0.0" }, async () => {
            this.launched = true;
            await this.nvim.outWriteLine("markdown server is launched.");
        });
    }
};
__decorate([
    (0, neovim_1.Autocmd)("TextChangedI", { pattern: "*", sync: true }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TestPlugin.prototype, "update_i", null);
__decorate([
    (0, neovim_1.Autocmd)("TextChanged", { pattern: "*", sync: true }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TestPlugin.prototype, "update", null);
__decorate([
    (0, neovim_1.Function)("MarkdownLaunch", { sync: false }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TestPlugin.prototype, "launch", null);
TestPlugin = __decorate([
    (0, neovim_1.Plugin)({ dev: false }),
    __metadata("design:paramtypes", [neovim_1.Neovim])
], TestPlugin);
exports.default = TestPlugin;
function convertImagePath(md) {
    return md.replace(/!\[(.*?)\]\((.*?)\)/g, (_, alt, imgPath) => {
        if (imgPath.startsWith("http://") || imgPath.startsWith("https://")) {
            return `![${alt}](${imgPath})`;
        }
        return `![${alt}](/local-file?path=${encodeURIComponent(imgPath)})`;
    });
}
