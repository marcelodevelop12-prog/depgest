# DepGest AI Rules & Tech Stack

## Tech Stack
- **Electron**: Core desktop framework providing native OS integration and IPC communication.
- **React & TypeScript**: Frontend library and type-safe language for building the user interface.
- **Vite**: Modern build tool and development server for fast HMR and optimized builds.
- **Tailwind CSS**: Utility-first CSS framework used for all styling and responsive design.
- **Zustand**: Lightweight state management for handling global application and PDV states.
- **Better-sqlite3**: High-performance local database for all offline-first data storage.
- **Supabase**: Cloud backend used for online menu synchronization, order tracking, and license validation.
- **Lucide React**: Standardized icon library for a consistent visual language.
- **Recharts**: Charting library for rendering financial reports and sales dashboards.

## Library Usage Rules
- **UI Components**: Always use **shadcn/ui** components as the primary building blocks. Supplement with custom **Tailwind CSS** for specific layouts.
- **Icons**: Use **Lucide React** exclusively for all interface icons.
- **State Management**: Use **Zustand** for global state. Create focused stores (like `useAppStore` or `usePdvStore`) rather than one giant store.
- **Local Data**: Never attempt to access the database directly from the frontend. Always use the `window.api` bridge defined in `preload.ts` to invoke Electron IPC handlers.
- **Cloud Data**: Use the **Supabase** client for features requiring cloud sync (Online Menu, Tracking).
- **Navigation**: Use **react-router-dom** for all internal routing. Keep route definitions in `src/App.tsx`.
- **Notifications**: Use **react-hot-toast** for all user-facing alerts and feedback.
- **Formatting**: Use the utility functions in `src/lib/utils.ts` for currency (`formatCurrency`), dates (`formatDate`), and phone numbers (`formatPhone`) to ensure locale consistency (pt-BR).
- **Styling**: Follow the CSS variable system defined in `src/index.css` for theme-aware colors (e.g., `var(--bg)`, `var(--card)`).