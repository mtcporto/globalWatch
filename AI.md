# IA

O provedor escolhido é `https://copilot-mtcporto.vercel.app/v1/`, modelo `gpt-4o`, sem chave. Texto e JSON foram testados com sucesso em 02/10/2026.

O único recurso de IA deste projeto era gerar uma foto com progressão de idade. Nos testes, `/images/generations` retornou texto, sem imagem; chamadas de visão a `/chat/completions` com PNG e JPEG sintéticos retornaram HTTP 400 (image media type not supported).

Por isso, a página de progressão de idade foi mantida com aviso de indisponibilidade, sem upload, chamada de IA ou simulação de imagem. O fluxo Gemini e seus testes foram removidos. As listagens FBI/Interpol permanecem disponíveis.

Quando o serviço oferecer geração de imagens validada, o recurso poderá ser reimplementado. Não existe fallback para Gemini ou Genkit.
