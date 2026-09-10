import React, { useMemo } from 'react';
import { formatAyahReply, parseAyahBriefing } from '../../lib/formatAyahReply';

type Props = {
  content: string;
};

function BriefingBlocks({ blocks }: { blocks: ReturnType<typeof parseAyahBriefing> }) {
  return (
    <div className="space-y-3 text-[15px] leading-relaxed text-[#1b2b2b]">
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          return (
            <p
              key={`heading-${index}`}
              className="pt-1 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#427160]"
            >
              {block.text}
            </p>
          );
        }
        if (block.type === 'bullet') {
          return (
            <div key={`bullet-${index}`} className="flex gap-2.5 pl-0.5">
              <span className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[#427160]" />
              <p className="flex-1 text-[#334155]">{block.text}</p>
            </div>
          );
        }
        return (
          <p key={`p-${index}`} className="text-[#1b2b2b]">
            {block.text}
          </p>
        );
      })}
    </div>
  );
}

export function AyahBriefingContent({ content }: Props) {
  const formatted = useMemo(() => formatAyahReply(content), [content]);
  const blocks = useMemo(() => parseAyahBriefing(formatted), [formatted]);

  if (!formatted) {
    return null;
  }

  if (blocks.length === 0) {
    return (
      <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#1b2b2b]">
        {formatted}
      </p>
    );
  }

  return <BriefingBlocks blocks={blocks} />;
}
