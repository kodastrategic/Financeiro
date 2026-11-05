---
name: UI/UX Design System
description: >
  Audita e redesenha interfaces web com foco em hierarquia visual, consistência,
  acessibilidade, responsividade e microinterações. Use ao criar, revisar ou
  melhorar telas, componentes, temas, layout, tipografia, cores, estados e fluxos
  de interação — especialmente em HTML/CSS/JS puro.
metadata:
  opencode/autoinvoke: true
---

# UI/UX Design System

Skill para conduzir melhorias de interface com critério de produto, não apenas
"deixar bonito". Toda mudança visual deve resolver um problema de uso.

## Quando usar

- Redesign ou refinamento de telas existentes.
- Criação de design system, tokens, tema claro/escuro.
- Auditoria de hierarquia, contraste, espaçamento, responsividade e acessibilidade.
- Revisão de estados (vazio, loading, erro, sucesso, hover, focus, disabled).
- Microinterações, transições e feedback.

## Fluxo obrigatório

### 1. Entender antes de mexer
1. Liste as telas, componentes e fluxos principais.
2. Leia o HTML/CSS/JS para mapear **contratos**: ids, classes, handlers e dados
   que o JS consome. Nunca renomeie ou remova um contrato sem atualizar o JS.
3. Capture o estado atual (screenshot desktop e mobile) e registre os problemas.
4. Use `references/audit-checklist.md` como roteiro.

### 2. Definir direção visual
- Escolha **uma** direção e documente em 1 frase (ex.: "dark editorial com
  superfícies em camadas e acento único").
- Limite a paleta: 1 acento, 2 semânticas (positivo/negativo), neutros.
- Defina escala de tipos com `clamp()` e escala de espaçamento de 4/8px.
- Tokens centralizados em `:root` (ver `references/tokens.md`).

### 3. Redesenhar de fora para dentro
Ordem de impacto:
1. **Layout e hierarquia** — grid, largura de leitura, alinhamento, densidade.
2. **Tipografia e cor** — contraste, pesos, tamanhos, números tabulares.
3. **Componentes** — cards, botões, inputs, tabelas, modais, navegação.
4. **Estados** — vazio, loading, erro, hover, focus, disabled, selecionado.
5. **Movimento** — 150–250ms, `ease`, respeitar `prefers-reduced-motion`.
6. **Acessibilidade** — teclado, foco visível, ARIA, contraste AA.

### 4. Regras de qualidade
- **Contraste**: texto normal ≥ 4.5:1; texto grande ≥ 3:1; nunca cinza claro
  sobre fundo claro.
- **Alvos de toque**: ≥ 44×44px no mobile.
- **Foco**: sempre visível; nunca `outline: none` sem substituto.
- **Tipografia**: máximo 2 famílias; line-height 1.4–1.6 no corpo; títulos
  com line-height 1.1–1.25; valores monetários com `font-variant-numeric: tabular-nums`.
- **Espaçamento**: use uma escala; evite valores mágicos repetidos.
- **Consistência**: mesmo raio, mesma sombra e mesmos estados para o mesmo tipo
  de elemento. Não misture 3 estilos de botão para a mesma ação.
- **Hierarquia**: uma ação primária por contexto. Secundárias com menos peso.
- **Densidade**: tables/listas compactas, mas com respiro entre seções.
- **Mobile**: nada de scroll horizontal acidental; tabelas podem rolar dentro
  de um container; inputs com `font-size: 16px` para evitar zoom no iOS.
- **Sem emoji como ícone estrutural** quando o alvo tem suporte inconsistente;
  prefira SVG inline ou máscara CSS. Emoji é aceitável como conteúdo.

### 5. Não quebrar o app
- Preserve ids/classes e a ordem de scripts.
- Evite `!important`; se precisar, justifique e limite o escopo.
- Não introduza dependências novas sem necessidade.
- Mudanças de markup devem ser incrementais e verificadas no navegador.

### 6. Verificar
1. Abra cada tela no navegador, desktop e mobile.
2. Confira console sem erros.
3. Teste teclado: Tab, Enter, Escape, foco em modais.
4. Teste estados vazios e com dados.
5. Rode `node --check` nos JS alterados.
6. Compare screenshots antes/depois.

## Referências

- `references/audit-checklist.md` — checklist de auditoria por dimensão.
- `references/tokens.md` — base de tokens e escalas.
- `references/component-patterns.md` — padrões de nav, cards, forms, tables,
  modais, chat, estados e responsividade.
- `references/finance-app.md` — contexto e contratos específicos deste app.

Leia a referência relevante antes de editar, não todas de uma vez.
