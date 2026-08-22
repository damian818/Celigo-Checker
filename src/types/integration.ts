export interface CeligoIntegration {
  id: string;
  name: string;
  environment: 'production' | 'sandbox' | 'staging' | 'development' | 'other';
  environmentLabel?: string;
  celigoUrl?: string;
}
