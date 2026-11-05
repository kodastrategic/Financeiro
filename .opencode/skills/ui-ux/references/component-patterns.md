# Padrões de componentes

## Navegação
- Header sticky com blur e hairline.
- Marca à esquerda; navegação à direita em desktop.
- Em mobile: tabs em scroll horizontal com `scroll-snap`, sem quebrar linha.
- Aba ativa: pill com contraste forte; inativas: texto secundário.
- Ícones opcionais, 16–18px, alinhados ao texto.

## Cabeçalho de página
```
eyebrow (12px, uppercase, muted)
h1 (28–36px, 600–700)
descrição (14px, secondary, max 60ch)
ações à direita
```

## Cards
- Superfície única, borda hairline, raio 14–20.
- Label pequena e muted; valor grande e tabular.
- Ícone em tile 32–36px quando ajuda a escanear.
- Hover: elevar 1–2px e clarear borda (apenas se clicável).
- Não usar sombra pesada em todos os cards ao mesmo tempo.

## Botões
- Primário: preenchido com acento, texto de alto contraste.
- Secundário: superfície neutra ou outline.
- Destrutivo: vermelho suave; confirmação obrigatória.
- Ghost/ícone: fundo transparente, hover sutil.
- Alturas: 32 (sm), 38 (md), 44 (lg/mobile).
- Ícone + texto com gap 6–8px; ícone sozinho exige aria-label.

## Inputs
- Label acima, 12–13px, medium.
- Altura 40–44px, raio 10–12, borda hairline.
- Focus: borda acento + anel de 3–4px translúcido.
- Erro: borda vermelha + mensagem abaixo.
- Prefixo/sufixo (R$, %) em container único.
- `font-size: 16px` no mobile.

## Tabelas
- Header 11–12px uppercase muted; linhas 44–52px.
- Valores numéricos à direita e tabulares.
- Hover de linha sutil.
- Ações à direita, compactas; destrutivas só no hover/focus.
- Container com overflow-x e indicador de scroll.
- Em mobile, permitir scroll interno; nunca esmagar colunas.

## Modais
- Overlay com blur; clique fora fecha.
- Largura `min(720px, calc(100vw - 32px))`; wide `900px`.
- Header fixo com título e botão fechar 36px.
- Corpo com scroll; footer fixo com ações.
- `role="dialog"`, `aria-modal="true"`, foco inicial e trap.
- Mobile: sheet ocupando 100dvh, raio apenas no topo.

## Chat / composer
- Container centrado (`max-width: 900–980px`).
- Mensagens com largura total do container, não 50%.
- Composer sticky no rodapé do container, com input pill e botão ícone.
- Autocomplete acima do input, mesma largura, navegável por teclado.
- Empty state com sugestões clicáveis.

## Estados vazios
- Ícone/tile, título curto, uma frase de apoio e CTA quando aplicável.
- Borda tracejada ou superfície sutil; nunca apenas texto solto.

## Notificações
- Canto inferior direito (desktop) / topo ou base central (mobile).
- Ícone, mensagem curta, auto-dismiss 3–4s.
- `role="status"` + `aria-live="polite"`.

## Responsividade
- 900px: grids de 3–4 colunas → 2.
- 768px: dashboard 2 colunas; painéis empilhados.
- 480px: tudo 1 coluna; tabs scroll; modais sheet; botões full-width quando fizer sentido.
