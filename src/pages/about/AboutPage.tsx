import { Eye, Info, Lock, MonitorCheck, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { StaggerItem } from '@/components/motion/Stagger';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAsync } from '@/hooks/useAsync';
import { getAppRuntimeInfo } from '@/services/systemService';

/**
 * Um princípio do produto: título, explicação e os pontos concretos.
 *
 * A página inteira é feita destes blocos — o texto é o conteúdo, e o layout
 * apenas o organiza.
 */
interface Principle {
  icon: LucideIcon;
  title: string;
  summary: string;
  points: readonly string[];
}

const PRINCIPLES: readonly Principle[] = [
  {
    icon: ShieldCheck,
    title: 'Segurança em primeiro lugar',
    summary:
      'Manutenção de computador só é útil quando você confia no que está acontecendo. Por isso, nada é feito às escondidas.',
    points: [
      'Nenhuma limpeza acontece sem a sua confirmação.',
      'Antes de remover qualquer coisa, o eloBoost mostra exatamente o que encontrou.',
      'Alterações de configuração criam um backup automático, para que você possa voltar atrás.',
      'Arquivos pessoais nunca são removidos sem a sua escolha, item a item.',
    ],
  },
  {
    icon: Lock,
    title: 'Privacidade',
    summary:
      'O eloBoost funciona inteiramente no seu computador. Não existe conta, servidor nem sincronização.',
    points: [
      'As informações lidas do seu computador ficam aqui e não são enviadas a lugar nenhum.',
      'Nenhum dado pessoal, documento ou histórico de navegação é coletado.',
      'Nada é compartilhado automaticamente — nem estatísticas de uso.',
      'Você pode apagar todos os dados locais do aplicativo quando quiser.',
    ],
  },
  {
    icon: Eye,
    title: 'Transparência',
    summary:
      'Você deve entender cada ação antes que ela aconteça, e conferir depois o que foi feito.',
    points: [
      'Cada limpeza mostra a lista do que será removido, com tamanho e local.',
      'Cada ajuste explica o que muda, o benefício esperado e os efeitos colaterais.',
      'Todas as ações ficam registradas num histórico que você pode consultar.',
      'Quando uma informação não puder ser lida do seu computador, o eloBoost diz isso — em vez de mostrar um número aproximado.',
    ],
  },
];

/**
 * Versão do aplicativo, no cabeçalho — o único dado técnico que ficou.
 *
 * Se a leitura falhar, o selo simplesmente não aparece. Um bloco de erro no
 * cabeçalho de uma página institucional seria desproporcional: a versão é
 * metadado, e a página continua inteiramente útil sem ela.
 */
function VersionBadge() {
  const runtime = useAsync(getAppRuntimeInfo);

  if (runtime.status === 'loading') {
    return <Skeleton className="h-6 w-24" label="Carregando a versão" />;
  }

  if (runtime.data == null) return null;

  return (
    <Badge tone="neutral" className="tabular">
      {/* Texto num só nó: fica mais previsível para leitores de tela e para os
          testes do que uma interpolação partida em vários nós. */}
      <span>{`versão ${runtime.data.version}`}</span>
      {runtime.data.buildProfile === 'debug' && (
        <span className="font-normal text-fg-muted">· desenvolvimento</span>
      )}
    </Badge>
  );
}

function PrincipleCard({ principle, index }: { principle: Principle; index: number }) {
  const Icon = principle.icon;

  return (
    <StaggerItem index={index}>
      <Card className="h-full">
        <CardHeader
          icon={<Icon className="size-4" />}
          title={principle.title}
          description={principle.summary}
        />
        <CardBody>
          <ul className="space-y-2.5">
            {principle.points.map((point) => (
              <li
                key={point}
                className="flex items-start gap-2.5 text-[0.8125rem] leading-relaxed text-fg-secondary"
              >
                <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-accent" />
                {point}
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </StaggerItem>
  );
}

/**
 * Página Sobre.
 *
 * Escrita para o usuário, não para o desenvolvedor: explica o que o eloBoost é,
 * como ele trata segurança, privacidade e transparência. Diagnóstico técnico —
 * banco de dados, schema, caminhos, alvo de compilação — vive no dashboard e
 * nos logs, não aqui.
 */
export function AboutPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Sobre o eloBoost"
        description="Um utilitário de manutenção para Windows 10 e 11, feito para ser confiável antes de ser rápido."
        action={<VersionBadge />}
      />

      <StaggerItem index={0}>
        <Card>
          <CardHeader
            icon={<Info className="size-4" />}
            title="O que é o eloBoost"
            description="Ferramentas de manutenção reunidas num só lugar, com o cuidado que o seu computador merece."
          />
          <CardBody>
            <div className="grid gap-5 text-sm leading-relaxed text-fg-secondary md:grid-cols-2">
              <p>
                Com o tempo, todo computador acumula arquivos temporários, programas que abrem
                sozinhos e configurações que ninguém lembra de ter mudado. O eloBoost reúne as
                ferramentas para cuidar disso — limpeza, análise de espaço, gerenciamento de
                inicialização e ajustes de desempenho — numa interface que explica cada passo.
              </p>
              <p>
                A ideia por trás do projeto é simples: um aplicativo de manutenção precisa ser
                confiável antes de ser rápido. Toda ação é reversível ou avisa claramente quando não
                é, cada número exibido vem de uma leitura real do seu computador, e você decide o
                que acontece.
              </p>
            </div>

            <div className="mt-5 flex items-center gap-2.5 rounded-[10px] border border-subtle bg-base/40 px-4 py-3">
              <MonitorCheck
                aria-hidden
                className="size-4 shrink-0 text-accent"
                strokeWidth={1.75}
              />
              <p className="text-[0.8125rem] text-fg-secondary">
                Desenvolvido especificamente para{' '}
                <strong className="font-medium text-fg">Windows 10 e Windows 11</strong>,
                aproveitando as ferramentas oficiais do próprio sistema.
              </p>
            </div>
          </CardBody>
        </Card>
      </StaggerItem>

      <div className="grid items-start gap-5 lg:grid-cols-3">
        {PRINCIPLES.map((principle, index) => (
          <PrincipleCard key={principle.title} principle={principle} index={index + 1} />
        ))}
      </div>
    </div>
  );
}
