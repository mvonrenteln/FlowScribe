# Fundamental Architecture Rules

> Scope note:
> This document describes architectural principles to FOLLOW when extending or modifying existing structures.
> It is NOT a mandate for broad refactors or architectural redesigns.
> Prefer minimal, local changes unless a structural issue is explicitly addressed.

## Code Quality Principles

1. **Separation of Concerns** - Each module should have a single, well-defined responsibility
   - Extract functions with different concerns into separate modules
   - Keep service layers focused on orchestration, utilities focused on computation
   - Example: Response parsing logic should be separate from feature-specific business logic

2. **Testability through Pure Functions**
   - Pure functions (no side effects, deterministic) should be extracted into separate utility modules
   - Service functions (with side effects like API calls) should be integration-tested with limited scope
   - Aim for 85%+ coverage on pure function utilities, 30-40% on service integration code
   - Never mix pure and impure logic in the same function

3. **Reusability and Composability**
   - Extract patterns that can be used across multiple features
   - Use established patterns (Strategy Pattern, Rule Pattern) instead of duplicating inline logic
   - Example: Recovery strategies for malformed responses, validation rules for input checking
   - Document reusable patterns for other developers to follow

4. **Maintainability through Clear Structure**
   - Changes to one concern should not affect unrelated modules
   - Keep module boundaries clean: types → utilities → services
   - Avoid deep nesting and complex interdependencies
   - Use established patterns to reduce complexity

## Architecture Patterns

1. **Strategy Pattern for Flexible Recovery**
   - Use when handling multiple fallback approaches
   - Example: Response recovery strategies (lenient-parse, partial-array, json-substring)
   - Allows adding new strategies without modifying existing code
   - Each strategy is independently testable

2. **Rule Pattern for Flexible Validation**
   - Use for validation logic that may change or extend
   - Example: Input validation rules with configurable issue levels
   - Separate rules from validation engine
   - Makes it easy to add/remove/modify rules

3. **Service Layer Separation**
   - **Pure Utilities** (in `utils.ts`): Formatting, calculations, data transformations
   - **Response Processing** (in `responseProcessor.ts`): Recovery, normalization, extraction
   - **Main Service** (in `service.ts`): Orchestration, AI execution, logging
   - Keep main service lean by delegating to specialized modules

4. **Type-Safe ID Mapping**
   - Use typed mapping structures (e.g., `BatchPairMapping`) instead of loose objects
   - Centralize ID transformation logic
   - Make ID mapping concerns explicit and separate

## Best Practices

- **Extract early (when extending code)**: If a function grows beyond ~30 lines or mixes concerns while adding new behavior, consider extraction.
- **Test utilities first**: Pure functions should be tested before being used in services
- **Log strategically**: Use structured logging (not console.log) for debugging and monitoring
- **Use established libraries**: Prefer existing, proven solutions when introducing new capabilities. Do not replace working infrastructure without clear necessity.
- **Document patterns**: When introducing new patterns, add examples to the architecture guide

### Performance guidance for agents and contributors

- **Prioritize O(1) lookups for hot paths**: When you see repeated `find`/`findIndex` calls over the same array (especially in render paths or loops), replace them with a precomputed lookup map (`Map`) and use O(1) `get` operations.
- **Memoize derived maps in React**: Use `useMemo` to compute maps derived from arrays and depend on the original array reference to avoid unnecessary rebuilds.
- **Agents modifying code must enforce this**: If an agent (or PR) changes code that previously used repeated scans, ensure the agent introduces a memoized map or documents why O(n) scans are acceptable. Include a unit test that would fail if maps are rebuilt per-call.
- **Place map construction at the outermost reasonable scope**: Build maps as high as possible (component-level or service-level) and pass them into deeper functions rather than reconstructing them in nested helpers.
