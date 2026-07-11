if exists("g:loaded_markdown_nvim")
  finish
endif

let g:loaded_markdown_nvim=1

let function_MarkdownLaunch={"type":"function","name":"MarkdownLaunch","sync":v:false,"opts":{}}
let autocmd_TextChanged={"type":"autocmd","name":"TextChanged","sync":v:false,"opts":{}}
let autocmd_TextChangedI={"type":"autocmd","name":"TextChangedI","sync":v:false,"opts":{}}

let functions=[function_MarkdownLaunch,autocmd_TextChanged,autocmd_TextChangedI]

let path=expand("<sfile>:p:h:h")."/dist/index.js"

call remote#host#RegisterPlugin("node",path,functions)
