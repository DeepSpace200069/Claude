import { notFound } from 'next/navigation';

/**
 * Nepoznata adresa (zahtev 22).
 *
 * Postoji zbog podele na dva korenska layout-a. Kada aplikacija ima više
 * korenskih layout-a, Next za adresu koja ne pogađa nijednu rutu nema layout u
 * koji bi je smestio, pa prikazuje svoju golu stranicu greške - bez našeg
 * okvira, navigacije i objašnjenja.
 *
 * Ova ruta hvata sve što nijedna druga nije uhvatila i vraća 404 **unutar**
 * grupe `(sajt)`, pa posetilac dobija istu stranicu kao i pre podele. Konkretnije
 * rute uvek imaju prednost, tako da ovo ne stoji nikome na putu.
 */
export default function UnknownPage(): never {
  notFound();
}
