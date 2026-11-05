# Checklist de auditoria UI/UX

Pontue cada item: ✅ ok · ⚠️ parcial · ❌ falha. Priorize ❌ que bloqueiam uso.

## 1. Hierarquia e layout
- [ ] A tela responde "onde estou, o que importa, o que faço agora" em 3s.
- [ ] Existe um título de página claro e consistente entre abas.
- [ ] A ação primária é visualmente dominante e única.
- [ ] Largura de leitura controlada (60–80ch em texto; containers com max-width).
- [ ] Conteúdo não fica espremido em uma coluna estreita com vazio ao lado.
- [ ] Grid alinha cards, forms e tabelas em colunas coerentes.
- [ ] Espaçamento entre seções > espaçamento interno dos componentes.

## 2. Tipografia
- [ ] No máximo 2 famílias.
- [ ] Escala consistente (ex.: 12/13/14/16/18/24/32/40).
- [ ] Títulos com peso e tracking adequados; corpo legível.
- [ ] Números monetários com `tabular-nums`.
- [ ] Nenhum texto essencial abaixo de 12px.
- [ ] Contraste mínimo AA.
- [ ] Line-height adequado (corpo 1.5; títulos 1.15).

## 3. Cor e superfícies
- [ ] Paleta limitada e semântica (acento, positivo, negativo, aviso).
- [ ] No máximo 3 níveis de superfície (fundo, card, elevado).
- [ ] Bordas e sombras consistentes, sem "caixa dentro de caixa".
- [ ] Estados usam cor + ícone/texto (não só cor).
- [ ] Dark mode sem preto puro e sem texto cinza insuficiente.

## 4. Componentes
- [ ] Botões com alturas e paddings consistentes; variantes claras.
- [ ] Inputs com label, placeholder útil, foco visível e erro.
- [ ] Tabelas com header legível, hover e scroll horizontal contido.
- [ ] Cards clicáveis têm affordance (hover, cursor, chevron).
- [ ] Modais com header, corpo e footer claros; fechamento óbvio.
- [ ] Navegação indica aba ativa sem ambiguidade.
- [ ] Ícones alinhados opticamente e com `aria-label` quando sozinhos.

## 5. Estados
- [ ] Vazio: explica o que é e como começar (não só "nada aqui").
- [ ] Loading: feedback sem bloquear tudo desnecessariamente.
- [ ] Erro: mensagem humana + ação de recuperação.
- [ ] Sucesso: confirmação discreta e temporária.
- [ ] Hover/focus/active/disabled visíveis.
- [ ] Nenhum estado depende só de hover (mobile).

## 6. Acessibilidade
- [ ] Foco visível em todos os interativos.
- [ ] Ordem de tabulação lógica.
- [ ] Modais: `role="dialog"`, `aria-modal`, foco preso, Escape fecha,
      foco retorna ao gatilho.
- [ ] `aria-live` para notificações e mensagens dinâmicas.
- [ ] Botões só com ícone têm `aria-label`/`title`.
- [ ] Contraste AA; alvos ≥ 44px no mobile.
- [ ] `prefers-reduced-motion` respeitado.

## 7. Responsividade
- [ ] Testado em 360, 390, 768 e 1280+.
- [ ] Sem overflow horizontal na página.
- [ ] Nav acessível em telas pequenas (scroll ou menu).
- [ ] Tabelas rolam dentro do container, não a página.
- [ ] Formulários em 1 coluna no mobile.
- [ ] Modais viram sheet de tela cheia no mobile.
- [ ] Composer/chat não fica atrás do teclado.

## 8. Performance percebida
- [ ] Imagens otimizadas e com `loading="lazy"`.
- [ ] Evitar layout shift (canvas com altura reservada).
- [ ] Animações baratas (transform/opacity).
- [ ] Feedback imediato ao clicar.

## 9. Consistência de produto
- [ ] Verbos e tom iguais entre telas.
- [ ] Mesmo componente resolve o mesmo problema em toda a app.
- [ ] Datas, moeda e números formatados igual.
- [ ] Confirmações destrutivas claras.
