import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { InfoList, InfoRow } from '@/components/domain/InfoRow';
import type { Availability } from '@/types/system';

const INDISPONIVEL: Availability<string> = {
  status: 'unavailable',
  reason: 'not_supported',
  message: 'Informação não suportada neste dispositivo.',
};

describe('InfoRow', () => {
  it('exibe o valor quando ele está disponível', () => {
    render(
      <InfoList>
        <InfoRow
          label="Edição do Windows"
          value={{ status: 'available', value: 'Windows 11 Pro' }}
        />
      </InfoList>,
    );

    expect(screen.getByText('Windows 11 Pro')).toBeInTheDocument();
  });

  it('resume o campo indisponível num rótulo curto, sem repetir a frase inteira', () => {
    render(
      <InfoList>
        <InfoRow label="Edição do Windows" value={INDISPONIVEL} />
      </InfoList>,
    );

    expect(screen.getByText('não disponível')).toBeInTheDocument();
    // A frase longa não ocupa a linha — ela vive no tooltip.
    expect(screen.queryByText(INDISPONIVEL.message)).not.toBeVisible();
  });

  it('revela o motivo completo ao passar o mouse', async () => {
    const user = userEvent.setup();
    render(
      <InfoList>
        <InfoRow label="Edição do Windows" value={INDISPONIVEL} />
      </InfoList>,
    );

    await user.hover(screen.getByText('não disponível'));

    expect(screen.getByRole('tooltip')).toHaveTextContent(INDISPONIVEL.message);
  });

  it('alcança o motivo pelo teclado, sem depender do ponteiro', async () => {
    const user = userEvent.setup();
    render(
      <InfoList>
        <InfoRow label="Edição do Windows" value={INDISPONIVEL} />
      </InfoList>,
    );

    await user.tab();

    expect(screen.getByText('não disponível')).toHaveFocus();
    expect(screen.getByRole('tooltip')).toHaveTextContent(INDISPONIVEL.message);
  });

  it('aceita um valor comum, sem embrulho de disponibilidade', () => {
    render(
      <InfoList>
        <InfoRow label="Memória instalada" value="32,0 GB" numeric />
      </InfoList>,
    );

    expect(screen.getByText('32,0 GB')).toBeInTheDocument();
  });
});
