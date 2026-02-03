---
name: eui-design-system
description: Build React apps using Elastic UI (EUI) design system. Enforces correct component usage, accessibility, theming, and layout patterns.
---

# Elastic UI (EUI) Design System

Use this skill when building React applications with the Elastic UI Framework.

## Setup Required

```tsx
import { EuiProvider } from '@elastic/eui';
import '@elastic/eui/dist/eui_theme_light.css';
// or '@elastic/eui/dist/eui_theme_dark.css'

function App() {
  return (
    <EuiProvider colorMode="light">
      {/* Your app */}
    </EuiProvider>
  );
}
```

---

## Layout Rules

### Page Structure
```tsx
import { EuiPage, EuiPageBody, EuiPageSection, EuiPageSidebar } from '@elastic/eui';

<EuiPage>
  <EuiPageSidebar paddingSize="l">
    {/* Navigation */}
  </EuiPageSidebar>
  <EuiPageBody paddingSize="none" panelled>
    <EuiPageSection>
      {/* Content */}
    </EuiPageSection>
  </EuiPageBody>
</EuiPage>
```

### Flex Layout (Primary Layout Tool)
```tsx
import { EuiFlexGroup, EuiFlexItem } from '@elastic/eui';

// Horizontal layout (default)
<EuiFlexGroup>
  <EuiFlexItem>Item 1</EuiFlexItem>
  <EuiFlexItem>Item 2</EuiFlexItem>
</EuiFlexGroup>

// Fixed width item
<EuiFlexItem grow={false}>Fixed</EuiFlexItem>

// Custom grow ratio
<EuiFlexItem grow={2}>Grows 2x</EuiFlexItem>
```

### Gutter Sizes
- `none` - No spacing
- `xs` - Extra small
- `s` - Small
- `m` - Medium
- `l` - Large (default)
- `xl` - Extra large

### Responsive Behavior
```tsx
// Stacks vertically on mobile (default)
<EuiFlexGroup>...</EuiFlexGroup>

// Stays horizontal on all screens
<EuiFlexGroup responsive={false}>...</EuiFlexGroup>
```

### Spacing Between Sections
```tsx
import { EuiSpacer } from '@elastic/eui';

<EuiSpacer size="m" /> // xs, s, m, l, xl, xxl
```

---

## Component Selection Guide

### Buttons

| Use Case | Component | Example |
|----------|-----------|---------|
| Primary action | `<EuiButton fill>` | Save, Create, Submit |
| Secondary action | `<EuiButtonEmpty>` | Cancel, Back |
| Icon-only action | `<EuiButtonIcon>` | Edit, Delete, Close |
| Destructive action | `<EuiButton color="danger">` | Delete, Remove |

**Button Pattern:**
```tsx
<EuiFlexGroup gutterSize="s">
  <EuiFlexItem grow={false}>
    <EuiButton fill>Save</EuiButton>
  </EuiFlexItem>
  <EuiFlexItem grow={false}>
    <EuiButtonEmpty>Cancel</EuiButtonEmpty>
  </EuiFlexItem>
</EuiFlexGroup>
```

**Button Colors:**
- `primary` - Default, main actions
- `success` - Positive confirmation
- `warning` - Caution actions
- `danger` - Destructive actions
- `text` - Low emphasis, dense UIs

### Panels

| Use Case | Props |
|----------|-------|
| Card with shadow | `<EuiPanel hasShadow>` |
| Bordered container | `<EuiPanel hasBorder>` |
| Subdued background | `<EuiPanel color="subdued">` |
| No styling | `<EuiPanel color="transparent" hasShadow={false}>` |

**Panel Nesting Rule:** When nesting 3+ panels, vary styles:
```tsx
<EuiPanel hasShadow>
  <EuiPanel color="subdued">
    <EuiPanel hasBorder hasShadow={false}>
      {/* Content */}
    </EuiPanel>
  </EuiPanel>
</EuiPanel>
```

### Forms

**Always wrap inputs in EuiFormRow:**
```tsx
import { EuiForm, EuiFormRow, EuiFieldText, EuiSelect, EuiSwitch } from '@elastic/eui';

<EuiForm component="form">
  <EuiFormRow label="Name" helpText="Enter your full name">
    <EuiFieldText name="name" />
  </EuiFormRow>

  <EuiFormRow label="Country">
    <EuiSelect
      options={[
        { value: 'us', text: 'United States' },
        { value: 'de', text: 'Germany' },
      ]}
    />
  </EuiFormRow>
</EuiForm>
```

**Validation Pattern:**
```tsx
<EuiFormRow
  label="Email"
  isInvalid={hasError}
  error={['Email is required.', 'Must be a valid email.']}
>
  <EuiFieldText name="email" isInvalid={hasError} />
</EuiFormRow>
```

**Switch Labeling Rules:**
- DO: Use static nouns - `"Malware protection"`
- DO: Use action verbs - `"Use recommended defaults"`
- DON'T: State-descriptive - `"Log enabled"`
- DON'T: Conditional - `"If enabled, uses protection"`

```tsx
// Correct
<EuiSwitch label="Malware protection" checked={enabled} onChange={toggle} />

// Wrong
<EuiSwitch label="Enable malware protection" checked={enabled} onChange={toggle} />
```

### Tables

**Basic Table:**
```tsx
import { EuiBasicTable } from '@elastic/eui';

const columns = [
  { field: 'name', name: 'Name' },
  { field: 'email', name: 'Email' },
  {
    field: 'actions',
    name: 'Actions',
    render: (item) => <EuiButtonIcon iconType="trash" aria-label="Delete" />
  },
];

<EuiBasicTable items={data} columns={columns} />
```

**Data Grid (for large datasets):**
```tsx
import { EuiDataGrid } from '@elastic/eui';

// When in flex layout, add min-width: 0 to container
<EuiFlexItem style={{ minWidth: 0 }}>
  <EuiDataGrid ... />
</EuiFlexItem>
```

### Modals & Flyouts

**Modal:**
```tsx
import { EuiModal, EuiModalHeader, EuiModalHeaderTitle, EuiModalBody, EuiModalFooter } from '@elastic/eui';

{isOpen && (
  <EuiModal onClose={closeModal}>
    <EuiModalHeader>
      <EuiModalHeaderTitle>Modal Title</EuiModalHeaderTitle>
    </EuiModalHeader>
    <EuiModalBody>
      {/* Content */}
    </EuiModalBody>
    <EuiModalFooter>
      <EuiButtonEmpty onClick={closeModal}>Cancel</EuiButtonEmpty>
      <EuiButton fill onClick={save}>Save</EuiButton>
    </EuiModalFooter>
  </EuiModal>
)}
```

**Flyout (side panel):**
```tsx
import { EuiFlyout, EuiFlyoutHeader, EuiFlyoutBody, EuiTitle } from '@elastic/eui';

{isOpen && (
  <EuiFlyout onClose={closeFlyout} aria-labelledby="flyoutTitle">
    <EuiFlyoutHeader hasBorder>
      <EuiTitle size="m">
        <h2 id="flyoutTitle">Flyout Title</h2>
      </EuiTitle>
    </EuiFlyoutHeader>
    <EuiFlyoutBody>
      {/* Content */}
    </EuiFlyoutBody>
  </EuiFlyout>
)}
```

---

## Theming

### Access Theme Values
```tsx
import { useEuiTheme } from '@elastic/eui';
import { css } from '@emotion/react';

function MyComponent() {
  const { euiTheme } = useEuiTheme();

  return (
    <div
      css={css`
        background: ${euiTheme.colors.lightShade};
        padding: ${euiTheme.size.l};
        border-radius: ${euiTheme.border.radius.medium};
        color: ${euiTheme.colors.text};
      `}
    >
      Content
    </div>
  );
}
```

### Color Mode
```tsx
// App-wide
<EuiProvider colorMode="dark">

// Section-specific
<EuiThemeProvider colorMode="dark">
  <EuiPanel>Dark panel</EuiPanel>
</EuiThemeProvider>

// Inverse (opposite of parent)
<EuiThemeProvider colorMode="inverse">
```

### Common Theme Tokens
```tsx
const { euiTheme } = useEuiTheme();

// Colors
euiTheme.colors.primary      // Brand primary
euiTheme.colors.success      // Green
euiTheme.colors.warning      // Yellow
euiTheme.colors.danger       // Red
euiTheme.colors.text         // Main text
euiTheme.colors.subduedText  // Secondary text
euiTheme.colors.lightShade   // Light background
euiTheme.colors.emptyShade   // White/black base

// Sizes
euiTheme.size.xs   // 4px
euiTheme.size.s    // 8px
euiTheme.size.m    // 12px
euiTheme.size.base // 16px
euiTheme.size.l    // 24px
euiTheme.size.xl   // 32px

// Use calc for computed sizes
padding: calc(${euiTheme.size.base} * 2);
```

---

## Accessibility Requirements

### Always Provide Labels
```tsx
// Icon buttons MUST have aria-label
<EuiButtonIcon iconType="trash" aria-label="Delete item" />

// Form fields need labels via EuiFormRow
<EuiFormRow label="Username">
  <EuiFieldText />
</EuiFormRow>

// Or use aria-label for hidden labels
<EuiFieldText aria-label="Search" />
```

### Screen Reader Content
```tsx
import { EuiScreenReaderOnly } from '@elastic/eui';

// Hidden but accessible
<EuiScreenReaderOnly>
  <p>This is only read by screen readers</p>
</EuiScreenReaderOnly>

// Visible on focus (skip links)
<EuiScreenReaderOnly showOnFocus>
  <a href="#main">Skip to main content</a>
</EuiScreenReaderOnly>
```

### Flyouts & Modals
```tsx
// Always include aria-labelledby
<EuiFlyout aria-labelledby="flyoutTitle">
  <EuiFlyoutHeader>
    <EuiTitle><h2 id="flyoutTitle">Title</h2></EuiTitle>
  </EuiFlyoutHeader>
</EuiFlyout>
```

---

## Common Patterns

### Settings Page
```tsx
<EuiPageSection>
  <EuiTitle><h1>Settings</h1></EuiTitle>
  <EuiSpacer size="l" />

  <EuiPanel hasBorder>
    <EuiTitle size="s"><h2>Profile</h2></EuiTitle>
    <EuiSpacer size="m" />

    <EuiForm>
      <EuiFormRow label="Display name">
        <EuiFieldText />
      </EuiFormRow>
      <EuiFormRow label="Email">
        <EuiFieldText type="email" />
      </EuiFormRow>

      <EuiSpacer size="m" />

      <EuiFlexGroup gutterSize="s">
        <EuiFlexItem grow={false}>
          <EuiButton fill>Save changes</EuiButton>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiButtonEmpty>Cancel</EuiButtonEmpty>
        </EuiFlexItem>
      </EuiFlexGroup>
    </EuiForm>
  </EuiPanel>
</EuiPageSection>
```

### Data List with Actions
```tsx
<EuiBasicTable
  items={items}
  columns={[
    { field: 'name', name: 'Name', sortable: true },
    { field: 'status', name: 'Status' },
    {
      name: 'Actions',
      actions: [
        {
          name: 'Edit',
          description: 'Edit this item',
          icon: 'pencil',
          type: 'icon',
          onClick: (item) => editItem(item),
        },
        {
          name: 'Delete',
          description: 'Delete this item',
          icon: 'trash',
          type: 'icon',
          color: 'danger',
          onClick: (item) => deleteItem(item),
        },
      ],
    },
  ]}
/>
```

### Empty State
```tsx
import { EuiEmptyPrompt, EuiButton } from '@elastic/eui';

<EuiEmptyPrompt
  iconType="folderOpen"
  title={<h2>No items found</h2>}
  body={<p>Create your first item to get started.</p>}
  actions={
    <EuiButton fill iconType="plus">Create item</EuiButton>
  }
/>
```

### Loading State
```tsx
import { EuiLoadingSpinner, EuiSpacer, EuiText } from '@elastic/eui';

<EuiFlexGroup alignItems="center" justifyContent="center" direction="column">
  <EuiFlexItem grow={false}>
    <EuiLoadingSpinner size="xl" />
  </EuiFlexItem>
  <EuiFlexItem grow={false}>
    <EuiText><p>Loading...</p></EuiText>
  </EuiFlexItem>
</EuiFlexGroup>
```

---

## Do's and Don'ts

### DO
- Use `EuiFlexGroup` for layouts, not CSS flexbox directly
- Wrap all form inputs in `EuiFormRow`
- Provide `aria-label` for icon-only buttons
- Use theme tokens via `useEuiTheme()` for custom styles
- Use `EuiSpacer` for vertical spacing between sections
- Use `fill` prop on primary action buttons

### DON'T
- Don't use raw `<button>` - use `EuiButton` family
- Don't hardcode colors - use theme tokens
- Don't nest more than 3 panels with same style
- Don't skip form labels for "obvious" fields
- Don't use multiple `fill` buttons in same button group
- Don't forget `responsive={false}` when horizontal layout is required on mobile

---

## Querying More Docs

Use Context7 to query specific EUI components:
```
Query EUI docs for: EuiDataGrid filtering sorting
Query EUI docs for: EuiComboBox async loading
Query EUI docs for: EuiSuperSelect custom options
```

Library ID: `/elastic/eui` (4,346 code snippets available)
