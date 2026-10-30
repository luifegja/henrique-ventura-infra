import { PageHeaderSkeleton, TableSkeleton } from "@/components/ui/skeleton";

/** Esqueleto genérico: cabeçalho + tabela. Rotas com forma própria têm o seu. */
export default function Loading() {
  return (
    <div className="animate-fade">
      <PageHeaderSkeleton />
      <TableSkeleton rows={8} cols={5} />
    </div>
  );
}
