# WooCommerce Order Reporting Dashboard - Design Guidelines

## Design Approach

**Selected Approach:** Design System (Data-Focused Dashboard)

**Primary Reference:** Stripe Dashboard + Material Design data visualization principles

**Justification:** This is a utility-focused, information-dense analytics application where data comprehension, efficiency, and professional presentation are paramount. The design should prioritize clarity, scanability, and quick insights over visual flourish.

**Key Design Principles:**
- Data hierarchy: Most critical metrics immediately visible
- Scannable layouts: Grid-based organization for quick information parsing
- Professional restraint: Clean, uncluttered interface that inspires confidence
- Efficient interactions: Minimal clicks to access detailed insights

## Typography System

**Font Family:** Inter or IBM Plex Sans via Google Fonts CDN

**Hierarchy:**
- Dashboard Title: text-3xl font-bold
- Section Headers: text-xl font-semibold
- Metric Values: text-4xl font-bold (for key numbers)
- Metric Labels: text-sm font-medium uppercase tracking-wide
- Body Text: text-base font-normal
- Table Headers: text-xs font-semibold uppercase tracking-wider
- Table Data: text-sm font-normal
- Buttons/Actions: text-sm font-medium

## Layout System

**Spacing Primitives:** Tailwind units of 2, 4, 6, 8, and 12
- Tight spacing: p-2, gap-2 (within components)
- Standard spacing: p-4, gap-4 (component padding)
- Section spacing: p-6, gap-6 (between related groups)
- Major spacing: p-8, gap-8 (page sections)
- Large spacing: p-12 (outer containers)

**Grid Structure:**
- Dashboard container: max-w-7xl mx-auto px-6
- Metrics grid: grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6
- Content sections: grid-cols-1 lg:grid-cols-3 gap-8 (2:1 split for chart:filters)

## Component Library

### Navigation Header
Top navigation bar with store logo/name, dark mode toggle, and user account menu. Sticky positioning (sticky top-0). Height h-16 with px-6 horizontal padding.

### Metrics Dashboard Cards
Four primary metric cards displayed in responsive grid:
- Total Revenue (current period)
- Total Orders (with comparison to previous period)
- Average Order Value
- Pending Orders Count

Each card structure: rounded-lg border with p-6 padding, metric label at top, large number display, trend indicator (↑/↓ with percentage change).

### Order Status Overview
Horizontal stat bars showing counts by status (Processing, Completed, Pending, Cancelled, Refunded, Failed). Each status gets dedicated card in grid-cols-2 md:grid-cols-3 lg:grid-cols-6 layout.

### Charts Section
Large chart area with tabbed navigation for different views:
- Orders Over Time (line/area chart)
- Revenue Trends (bar chart)
- Status Distribution (donut chart)

Chart container: rounded-lg border p-6, minimum height h-96. Use Chart.js or Recharts via CDN for visualization.

### Filters Panel
Sidebar or top panel with filter controls:
- Date range picker (preset ranges: Today, Last 7 days, Last 30 days, Custom)
- Status multi-select dropdown
- Search by order number or customer
- Apply/Reset buttons

Layout as vertical stack with gap-4 spacing between filter groups.

### Orders Table
Full-width responsive table with:
- Columns: Order #, Customer, Date, Status, Total, Actions
- Sortable headers (clickable with sort icons)
- Row hover state for better scanning
- Status badges with rounded-full px-3 py-1 styling
- Actions dropdown menu per row
- Pagination controls at bottom

Mobile: Stack into card layout below md breakpoint.

### Export & Actions Bar
Positioned above table with space-between layout:
- Left: "Showing X-Y of Z orders" count
- Right: Export to CSV button, Refresh button

### Dark Mode Implementation
Toggle switch in header. Affects:
- Background layers: Base background, elevated surfaces (cards/tables), overlays
- Text hierarchy: Primary, secondary, disabled states
- Borders and dividers
- Chart color schemes

Store preference in localStorage for persistence.

## Data Visualization

**Chart Requirements:**
- Use consistent color palette across all charts (defined in color phase)
- Include legend, axis labels, tooltips on hover
- Responsive sizing with maintainAspectRatio
- Grid lines for easier reading
- Smooth animations on load (duration: 750ms)

**Icons:** Use Heroicons via CDN for all interface icons (chevrons, calendar, download, refresh, etc.)

## Accessibility

- All interactive elements have min-height/min-width of 44px
- Form inputs include visible labels and placeholder text
- Keyboard navigation fully supported (tab order logical)
- Focus states visible on all interactive elements (ring-2)
- Status badges use both color and text/icons for information
- High contrast maintained in both light and dark modes

## Page Structure

1. **Header** (sticky): Logo, navigation, dark mode toggle, account menu
2. **Dashboard Title & Period Selector**: Page heading with date range display
3. **Metrics Grid**: 4-column KPI cards
4. **Status Overview**: 6-column status count cards
5. **Main Content Area**: 
   - Charts section (2/3 width on desktop)
   - Filters panel (1/3 width, sticky on desktop, collapsible on mobile)
6. **Orders Table Section**: Full-width with search/export controls
7. **Footer**: Minimal with sync status and last updated timestamp

No hero section needed - this is a functional dashboard where users dive straight into data upon login.