import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AutoRenewalService } from '../types';

interface AutoRenewalServicesProps {
  services: AutoRenewalService[];
}

/**
 * 自动续订服务组件
 */
export function AutoRenewalServices({ services }: AutoRenewalServicesProps) {
  const { t } = useTranslation('billing');
  const navigate = useNavigate();

  return (
    <div>
      <h2 className="text-sm font-semibold text-foreground mb-4">{t('autoRenewal.title')}</h2>
      <div className="bg-background border border-border rounded-lg p-4">
        {services.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <DollarSign className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-xs text-muted-foreground mb-3">{t('autoRenewal.noServices')}</p>
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() => navigate('/plans')}
            >
              {t('autoRenewal.setup')}
            </Button>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-accent/40">
              <tr className="text-left">
                <th className="px-3 py-2">{t('autoRenewal.serviceDetails')}</th>
                <th className="px-3 py-2">{t('autoRenewal.renewalPrice')}</th>
                <th className="px-3 py-2">{t('autoRenewal.nextBillDate')}</th>
              </tr>
            </thead>
            <tbody>
              {services.map((service) => (
                <tr key={service.id} className="border-t border-border">
                  <td className="px-3 py-2">{service.serviceName}</td>
                  <td className="px-3 py-2">
                    ${service.renewalPrice} {service.currency}
                  </td>
                  <td className="px-3 py-2">{service.nextBillDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
