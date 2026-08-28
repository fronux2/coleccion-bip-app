import { Redirect } from 'expo-router';

// NativeTabs has no route named "index" (the first real tab is
// "catalogo"), but web/deep-link resolution to "/" still needs
// something to match -- this sends it straight to the default tab.
export default function Index() {
  return <Redirect href="/catalogo" />;
}
