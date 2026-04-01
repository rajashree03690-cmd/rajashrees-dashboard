import { useQuery } from '@tanstack/react-query';
import { customersService } from '@/modules/crm/services/customers.service';

export function useCustomers() {
    return useQuery({
        queryKey: ['customers'],
        queryFn: () => customersService.fetchCustomers(),
        staleTime: 60000,
    });
}
