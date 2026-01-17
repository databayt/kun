# Test Generator

Generate comprehensive tests for code.

## Test Types

### Unit Tests (Vitest)
```tsx
describe('functionName', () => {
  it('should handle normal case', () => {});
  it('should handle edge case', () => {});
  it('should throw on invalid input', () => {});
});
```

### Component Tests
```tsx
import { render, screen } from '@testing-library/react';

describe('Component', () => {
  it('renders correctly', () => {});
  it('handles user interaction', () => {});
});
```

### E2E Tests (Playwright)
```tsx
test('user flow', async ({ page }) => {
  await page.goto('/');
  await page.click('button');
  await expect(page).toHaveURL('/success');
});
```

## Coverage Target: 95%+

## Usage
```
/test src/lib/utils.ts       # Unit tests
/test src/components/Button  # Component tests
/test e2e login              # E2E flow
/test coverage               # Run coverage report
```

Generate tests: $ARGUMENTS
