import {Context, Hono} from "hono";
import {serve} from "@hono/node-server";
import { Autocmd, Function, Neovim, Plugin } from "neovim";
import mi from "markdown-it";
import hljs from "highlight.js";
import texmath from "markdown-it-texmath";
import katex from "katex";
import {serveStatic} from "@hono/node-server/serve-static";
import fs from "fs";
import path from "path";

const DIST_DIR=path.resolve(__dirname,"..");

const md=new mi({
  html:true,
  highlight(str,lang){
    if (lang && hljs.getLanguage(lang)){
      return `<pre><code class="hljs">${hljs.highlight(str,{language:lang}).value}</code></pre>`;
    }
    return `<pre><code class="hljs">${md.utils.escapeHtml(str)}</code></pre>`;
  }
});

md.use(texmath,{
  engine:katex,
  delimiters:"dollars"
});

@Plugin({dev:false})
export default class TestPlugin{
  private app:Hono;
  private markdown:string="";
  private launched:boolean=false;
  constructor(private nvim:Neovim){}
  @Autocmd("TextChangedI",{pattern:"*",sync:true})
  async update_i(){
    if (this.launched){
      const lines=(await this.nvim.buffer.lines).join("\n");
      this.markdown=lines;
    }
  }
  @Autocmd("TextChanged",{pattern:"*",sync:true})
  async update(){
    if (this.launched){
      const lines=(await this.nvim.buffer.lines).join("\n");
      this.markdown=lines;
    }
  }
  @Function("MarkdownLaunch",{sync:false})
  async launch(){
    let old_text="";
    this.app=new Hono();

    this.app.use("/dist/*",serveStatic({root:DIST_DIR}));

    this.app.get("/update",(c:Context)=>{
      const text=md.render(convertImagePath(this.markdown));
      if (old_text===text){
        return c.text("n",400);
      }
      old_text=text;
      return c.text(text);
    });

    this.app.get("/local-file", async (c) => {
      const filepath = c.req.query("path");
      if (!filepath) {
        return c.text("not found", 404);
      }
      try {
        const file = fs.readFileSync(filepath);
        const ext = path.extname(filepath);
        const mime: Record<string, string> = {
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
      } catch {
        return c.text("file not found", 404);
      }
    });

    this.app.get("/show",(c:Context)=>{
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
        if (response.status!=400 && text!="n"){
          console.log(response);
          app.innerHTML=text;
        }
      },100);
    </script>
  </body>
</html>`);
    });

    serve({fetch:this.app.fetch,port:3456,hostname:"0.0.0.0"},async ()=>{
      this.launched=true;
      await this.nvim.outWriteLine("markdown server is launched.");
    });
  }
}

function convertImagePath(md: string): string {
  return md.replace(/!\[(.*?)\]\((.*?)\)/g,(_, alt, imgPath)=>{
      if (imgPath.startsWith("http://") || imgPath.startsWith("https://")){
        return `![${alt}](${imgPath})`;
      }
      return `![${alt}](/local-file?path=${encodeURIComponent(imgPath)})`;
    }
  );
}
