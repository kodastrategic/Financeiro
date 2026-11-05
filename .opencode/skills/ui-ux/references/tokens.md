# Tokens e escalas

## Espaçamento (base 4px)
```
--space-1: 4px;   --space-2: 8px;   --space-3: 12px;
--space-4: 16px;  --space-5: 20px;  --space-6: 24px;
--space-8: 32px;  --space-10: 40px; --space-12: 48px;
```

## Tipografia
```
--text-xs: 0.72rem;   /* 11.5px – labels, meta */
--text-sm: 0.8rem;    /* 12.8px – secundário */
--text-base: 0.9rem;  /* 14.4px – corpo denso */
--text-md: 1rem;      /* 16px – corpo */
--text-lg: 1.15rem;   /* 18.4px – subtítulo */
--text-xl: clamp(1.35rem, 2vw, 1.65rem);
--text-2xl: clamp(1.7rem, 3vw, 2.2rem);
--text-3xl: clamp(2rem, 4vw, 2.8rem);
```

## Raios
```
--radius-xs: 6px; --radius-sm: 10px; --radius: 14px;
--radius-lg: 20px; --radius-xl: 26px; --radius-pill: 999px;
```

## Sombras (dark)
```
--shadow-sm: 0 1px 2px rgba(0,0,0,.3);
--shadow: 0 8px 24px rgba(0,0,0,.35);
--shadow-lg: 0 24px 64px rgba(0,0,0,.5);
```

## Cores semânticas
- Acento: uma cor, usada com parcimônia.
- Positivo (receita): verde.
- Negativo (despesa): vermelho/coral.
- Aviso: âmbar.
- Neutros: 3–4 níveis de texto + 3 níveis de superfície.

## Motion
```
--dur-fast: 120ms; --dur: 180ms; --dur-slow: 280ms;
--ease: cubic-bezier(.2,.8,.2,1);
```
- Hover/focus: 120–180ms.
- Entrada de modal: 180–240ms.
- Nunca anime propriedades de layout (width/height/top/left).
- `@media (prefers-reduced-motion: reduce)` desliga animações não essenciais.

## Grid responsivo
```
container: min(1200px, 100% - 2 * gutter)
gutter: 16px mobile / 24px tablet / 32px desktop
columns: 4 mobile / 8 tablet / 12 desktop
breakpoints: 480, 768, 900, 1200
```
