import { Main, PageTitle, Placeholder } from "@/client/components/shell/regions";
import { requireAdmin } from "@/server/auth/require-admin";

export default async function TimingPage() {
  await requireAdmin();
  return (
    <Main>
      <PageTitle title="Timing editor" sub="Set where each verse starts and ends" />
      <Placeholder milestone="M15 · Timing editor">
        Waveform, ruler, zoom, scrub, draggable handles, numeric entry, autosave.
      </Placeholder>
    </Main>
  );
}
