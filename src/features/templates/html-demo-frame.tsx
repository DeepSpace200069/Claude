/**
 * Uvezen sajt u okviru galerije (zahtev 6 i 39.4).
 *
 * Sajt ne može da se ubaci u našu stranicu: donosi svoj `<html>`, svoj reset i
 * svoje fontove, pa bi se dva skupa stilova pomešala i pokvarila oba. Zato se
 * prikazuje kroz `<iframe>` koji pokazuje na `/demo-sajt/<slug>` - rutu sa
 * sopstvenim dokumentom. Traka sa dugmadima time ostaje u našem izgledu, a sajt
 * u svom.
 *
 * `sandbox` dozvoljava skripte, jer bez njih nema animacija - a upravo su
 * animacije ono što se u ovakvom šablonu i pokazuje. Ostalo ostaje zabranjeno:
 * demo ne može da odvede posetioca sa stranice, da otvori prozor ni da pošalje
 * formu. Bez `allow-same-origin` je sadržaj u zasebnom poreklu, pa ne vidi ni
 * kolačiće ni DOM stranice oko sebe.
 */
export function HtmlDemoFrame({
  slug,
  title,
  className,
}: {
  slug: string;
  title: string;
  className?: string;
}) {
  return (
    <iframe
      src={`/demo-sajt/${slug}`}
      title={title}
      loading="lazy"
      sandbox="allow-scripts"
      className={className ?? 'h-[80vh] w-full border-0 bg-white'}
    />
  );
}
