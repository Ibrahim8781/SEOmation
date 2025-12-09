import { useEffect, useState } from 'react';
import { FiCheck, FiExternalLink, FiLink, FiRefreshCw, FiTrash2 } from 'react-icons/fi';
import { IntegrationsAPI } from '@/api/integrations';
import type { IntegrationPlatform, PlatformIntegration } from '@/types';
import { extractErrorMessage } from '@/utils/error';
import { Button } from '@/components/ui/Button';
import './integrations.css';

const providers: { label: string; value: IntegrationPlatform; description: string }[] = [
  { label: 'WordPress', value: 'WORDPRESS', description: 'Publish full blog posts with HTML.' },
  { label: 'LinkedIn', value: 'LINKEDIN', description: 'Share posts to your LinkedIn feed.' },
  { label: 'Instagram', value: 'INSTAGRAM', description: 'Publish images and captions.' }
];

export function IntegrationsPage() {
  const [items, setItems] = useState<PlatformIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await IntegrationsAPI.list();
      setItems(data.items);
    } catch (err) {
      setError(extractErrorMessage(err, 'Unable to load integrations.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const connect = async (platform: IntegrationPlatform) => {
    try {
      const { data } = await IntegrationsAPI.getAuthUrl(platform);
      window.location.href = data.url;
    } catch (err) {
      setError(extractErrorMessage(err, 'Unable to start connection.'));
    }
  };

  const disconnect = async (platform: IntegrationPlatform) => {
    try {
      await IntegrationsAPI.disconnect(platform);
      setItems((prev) => prev.filter((item) => item.platform !== platform));
    } catch (err) {
      setError(extractErrorMessage(err, 'Unable to disconnect.'));
    }
  };

  return (
    <div className="integrations-page">
      <header className="integrations-header">
        <div>
          <h1>Integrations</h1>
          <p>Connect your publishing platforms to schedule or publish directly.</p>
        </div>
        <Button variant="ghost" leftIcon={<FiRefreshCw />} onClick={load} isLoading={loading}>
          Refresh
        </Button>
      </header>

      {error && <div className="integrations-error glass-card">{error}</div>}

      <div className="integrations-grid">
        {providers.map((provider) => {
          const connected = items.find((item) => item.platform === provider.value);
          return (
            <article key={provider.value} className="integration-card glass-card">
              <div className="integration-card__header">
                <div>
                  <h3>{provider.label}</h3>
                  <p>{provider.description}</p>
                </div>
                {connected ? <FiCheck color="#52c41a" /> : <FiLink />}
              </div>
              {connected && (
                <div className="integration-card__meta">
                  <span>ID: {connected.id.slice(0, 8)}</span>
                  {connected.expiresAt && (
                    <span>Expires {new Date(connected.expiresAt).toLocaleDateString()}</span>
                  )}
                </div>
              )}
              <div className="integration-card__actions">
                {!connected && (
                  <Button variant="primary" onClick={() => connect(provider.value)} leftIcon={<FiExternalLink />}>
                    Connect
                  </Button>
                )}
                {connected && (
                  <Button variant="ghost" onClick={() => disconnect(provider.value)} leftIcon={<FiTrash2 />}>
                    Disconnect
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
