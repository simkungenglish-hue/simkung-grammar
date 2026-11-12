# Supabase 설치 파일 (화면 파일과 따로 Supabase에서 실행해요)

순서대로 **SQL Editor**에 붙여넣고 Run 하세요. 여러 번 실행해도 안전해요.
1. `schema11_vocab.sql` — 11단계 어휘 (단어장·6단계 학습·간격 복습)
2. `schema12_passage.sql` — 12단계 중등 내신 본문 (문장 성분·1~5형식, "문장의 형식" 단원 포함)
3. `schema13_vocab_game.sql` — 13단계 어휘 게임·철자 익히기·AI 자동 단어장
4. `schema14_egu_exam.sql` — 14단계 EGU 교재(AI 음성)·앞 유닛 복습·학습 시간·범위 시험·오답관리

`functions/ai-feedback/index.ts` 는 Edge Functions → ai-feedback → Code 에 통째로 붙여넣고 Deploy 해요.
(지금 운영 중인 버전의 리포트 코멘트 기능을 그대로 두고 본문 분석·AI 단어장·사진 읽기를 더한 파일이에요.)


## 15단계 · 16단계 (학습 단계 고르기 · 게임 열기 · READ & BEAT)
- `schema15_steps_games.sql`: 학생·교재별로 학습 단계를 고를 수 있게 하고, 유닛 테스트를 통과하면 게임이 열리게 해요.
- `schema16_readbeat.sql`: READ & BEAT 곡(교재 본문)을 로그인한 사람만 볼 수 있게 저장하는 표예요. 교재 본문은 GitHub 공개 파일에 넣지 않아요.
- `schema17_notify.sql`: 어휘 유닛을 처음 통과하면, 불규칙동사는 오늘 새 동사 학습을 끝내면 카톡 「나와의 채팅」으로 알려요. 기존 「학습 제출 알림」 주소와 스위치를 그대로 써요.
