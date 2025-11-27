import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiFileText,
  FiEdit3,
  FiHome,
  FiLogOut,
  FiSettings
} from 'react-icons/fi';
import { FaInstagram } from 'react-icons/fa';
import { SiWordpress } from 'react-icons/si';
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

      <div className="app-sidebar__section">
        <h3 className="app-sidebar__section-title">Integrated Modules</h3>
        <div className="app-sidebar__module">
          <div className="app-sidebar__module-info">
            <span className="app-sidebar__module-icon instagram">
              <FaInstagram />
            </span>
            <span className="app-sidebar__label">Instagram</span>
          </div>
          <FiChevronDown />
        </div>
        <div className="app-sidebar__module">
          <div className="app-sidebar__module-info">
            <span className="app-sidebar__module-icon wordpress">
              <SiWordpress />
            </span>
            <span className="app-sidebar__label">WordPress</span>
          </div>
          <FiChevronDown />
        </div>
      </div>

      <div className="app-sidebar__footer">
        <NavLink
          to="/settings/integrations"
          className={({ isActive }) =>
            isActive ? 'app-sidebar__footer-btn app-sidebar__footer-btn--active' : 'app-sidebar__footer-btn'
          }
        >
          <FiSettings />
          <span className="app-sidebar__label">Settings</span>
        </NavLink>
        <Button variant="ghost" onClick={logout} leftIcon={<FiLogOut />} className="app-sidebar__logout">
          <span className="app-sidebar__label">Log out</span>
        </Button>
        <div className="app-sidebar__brand">SEOmation</div>
      </div>
    </aside>
  );
}
