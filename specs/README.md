# Specs — especificaciones del proyecto (flujo SDD)

Cada petición del usuario se convierte en una **spec** numerada dentro de
`specs/NNN-nombre/`. Los tres ficheros los produce el **Planner** y los
consumen el **Coordinator**, el **Implementer** y el **Reviewer**.

```
specs/
└── 001-nombre-corto/
    ├── spec.md    ← QUÉ y POR QUÉ (requisitos en EARS, casos límite)
    ├── plan.md    ← archivos, funciones puras, decisiones, estrategia de tests
    └── tasks.md   ← máximo 10 tareas ordenadas, cada una con sus RF
```

## Reglas de la carpeta

- **`spec.md`**: requisitos en EARS (`EL SISTEMA DEBE…`), con su "Estado:
  borrador". Solo el QUÉ y el POR QUÉ: nada de stack, arquitectura ni
  nombres de fichero.
- **`plan.md`**: se redacta a partir de la spec aprobada. Incluye los
  archivos, las funciones puras con "hoy" como parámetro, cada decisión con
  la alternativa descartada, la estrategia de tests (`npx playwright test`)
  y qué requisito funcional (RF) cubre cada parte.
- **`tasks.md`**: máximo 10 tareas, en orden, cada una con sus RF y su
  "Hecho cuando:". El Implementer marca cada tarea como hecha y para.
- El número `NNN` es el siguiente libre; el nombre de la carpeta es corto y
  en minúsculas con guiones.

## Permisos

El Planner solo escribe dentro de `specs/`; el Implementer escribe en el
código; el Reviewer no escribe nada. El flujo completo y sus gates están
descritos en `AGENTS.md` y en `.pi/agents/`.
