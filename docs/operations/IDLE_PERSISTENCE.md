# 방치 성장 운영 저장소

웹 RPG 진행, 장비/젬/주얼, 홀덤 지갑, 구매·정산·보상 영수증을 `RPG_SAVE_DIR/game.sqlite` 하나에 저장한다. 두 프로세스는 같은 파일을 열고 WAL·busy timeout·BEGIN IMMEDIATE 및 revision CAS를 사용한다. 시작 시 기존 players.sqlite/items.sqlite는 삭제하지 않고 한 번 복사한다. SQL 실패 시 결제·획득·시계·영수증을 함께 롤백한다.

## 현재 배포 경계

2026-11-01 확인 시 Render 서비스는 Free, 영구 디스크와 외부 DB는 없었다. 코드의 파일 영속성과 운영 인프라의 배포 간 영속성은 다르다. 현재 무료 파일시스템에서는 재배포/인스턴스 교체 시 DB가 사라질 수 있다. **이 상태를 영구 저장 완료라고 부르지 않는다.** 기존 인메모리 지갑의 과거 런타임 잔액은 원본 백업이 없어 복구할 수 없다.

## 적용할 구체적 구성 (유료 인프라 변경 전 검토용)

기존 서비스 `srv-dbb816bbc2fs73dds24g`를 유료 인스턴스로 변경하고 1GB 디스크를 `/var/data`에 붙인다. `RPG_SAVE_DIR=/var/data/rpg`, `RPG_STORAGE_DURABLE=1`을 지정한다. 무료 render.yaml을 자동으로 유료로 바꾸지는 않는다. 비용·결제 승인이 필요한 변경이다. 현재 MCP에는 기존 서비스의 요금제/디스크 변경 기능이 없어 Render Dashboard에서 변경한다.

단일 서비스·단일 인스턴스를 유지한다. 디스크가 있으면 Render는 이전 프로세스를 종료하고 새 프로세스를 시작하므로 짧은 배포 중단이 있다. 웹/포커 두 프로세스를 별도 서비스로 쪼개면 이 로컬 SQLite 설계는 사용할 수 없다. 그때는 PostgreSQL 등 공유 DB로 전환한다.

연결 순서:
1. 실행 중 DB를 아래 명령으로 백업하고 외부에 다운로드한다. 새 디스크를 만들기 전에 기존 무료 인스턴스의 파일을 확보한다. 과거 메모리 전용 데이터는 포함되지 않는다.
2. 디스크/요금제를 변경하고 위 환경변수를 적용한다. 원본 백업을 새 마운트의 game.sqlite로 복원한다. 복원은 모든 DB 사용 프로세스를 멈춘 상태에서 수행하고 기존 game.sqlite, -wal, -shm은 별도 보관한다. 실행 중인 DB 파일을 덮어쓰지 않는다.
3. /healthz와 /api/release의 storage가 `configured-persistent-volume`인지 확인한다. 성장·소환·주얼 구매 후 값을 기록한다.
4. 재시작 후 같은 브라우저/지갑 토큰으로 확인하고, 별도 재배포 후 다시 확인한다. 완료 전에는 운영 영속성 검증 통과로 기록하지 않는다.

## DB 자체 백업

```sh
node scripts/rpg/backup-game-db.mjs /var/data/rpg/game.sqlite /var/data/backups/game-YYYYMMDD.sqlite
```

SQLite VACUUM INTO로 일관된 복사본을 만들고 원본·복사본 integrity_check를 확인한다. 같은 디스크에만 두면 디스크 손실을 견디지 못하므로 외부로 다운로드해야 한다. Render 디스크 스냅샷을 SQLite DB의 개별 복원 수단으로 사용하지 않는다.

중단된 현금게임은 마지막 커밋된 핸드 체크포인트의 테이블 칩을 반환한다. 진행 중 미정산 베팅은 취소된다. 재시작 writer epoch가 이전 포커 프로세스의 후속 쓰기를 차단한다. 이는 영구 디스크 자체를 대신하지 않는다.

참고: https://render.com/docs/disks
