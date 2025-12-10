import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiFileText,
  FiEdit3,
  FiHome,
  FiLink,
  FiLogOut
} from 'react-icons/fi';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import './sidebar.css';

const primaryNav = [
  {
    label: 'Home',
    icon: <FiHome />,
    to: '/',
    end: true
  },
  {
    label: 'Blog Writer',
    icon: <FiEdit3 />,
    to: '/writer'
  },
  {
    label: 'Content',
    icon: <FiFileText />,
    to: '/content'
  },
  {
    label: 'Schedule',
    icon: <FiClock />,
    to: '/schedule'
  },
  {
    label: 'Integrations',
    icon: <FiLink />,
    to: '/settings/integrations'
  }
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user, logout } = useAuth();
  const initials =
    user?.name
      ?.split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase() ?? 'U';

  const workspaceName = user ? `${user.name.split(' ')[0]}'s Workspace` : 'Workspace';

  return (
    <aside className={clsx('app-sidebar', collapsed && 'app-sidebar--collapsed')}>
      <div className="app-sidebar__top">
        <button
          type="button"
          className="app-sidebar__collapse"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <FiChevronRight /> : <FiChevronLeft />}
        </button>
      </div>

      <div className="app-sidebar__workspace">
        <div className="app-sidebar__avatar">{initials}</div>
        <div className="app-sidebar__workspace-meta">
          <h2 className="app-sidebar__workspace-title">{workspaceName}</h2>
          <p>{user?.company ?? 'SEOmation'}</p>
        </div>
      </div>

      <nav className="app-sidebar__nav">
        {primaryNav.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            className={({ isActive }) =>
              isActive ? 'app-sidebar__nav-item app-sidebar__nav-item--active' : 'app-sidebar__nav-item'
            }
            end={item.end}
          >
            <span className="app-sidebar__nav-icon">{item.icon}</span>
            <span className="app-sidebar__label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="app-sidebar__footer">
        <Button variant="ghost" onClick={logout} leftIcon={<FiLogOut />} className="app-sidebar__logout">
          <span className="app-sidebar__label">Log out</span>
        </Button>
        <div className="app-sidebar__brand">SEOmation</div>
      </div>
    </aside>
  );
}
