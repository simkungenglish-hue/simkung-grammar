# Supabase 설치 파일 (화면 파일과 따로 Supabase에서 실행해요)

순서대로 **SQL Editor**에 붙여넣고 Run 하세요. 여러 번 실행해도 안전해요.
1. `schema11_vocab.sql` — 11단계 어휘 (단어장·6단계 학습·간격 복습)
2. `schema12_passage.sql` — 12단계 중등 내신 본문 (문장 성분·1~5형식, "문장의 형식" 단원 포함)
3. `schema13_vocab_game.sql` — 13단계 어휘 게임·철자 익히기·AI 자동 단어장

`functions/ai-feedback/index.ts` 는 Edge Functions → ai-feedback → Code 에 통째로 붙여넣고 Deploy 해요.
(지금 운영 중인 버전의 리포트 코멘트 기능을 그대로 두고 본문 분석·AI 단어장·사진 읽기를 더한 파일이에요.)
