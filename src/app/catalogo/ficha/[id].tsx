import { useLocalSearchParams } from 'expo-router';

import { FichaScreen } from '@/components/ficha-screen';

export default function CatalogoFicha() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <FichaScreen id={id} />;
}
