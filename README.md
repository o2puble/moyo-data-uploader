# moyo-data-uploader

세계의 국기 및 도시 데이터를 서버에 업로드 합니다.

### To install dependencies

```bash
npm install
```

.env 파일을 생성하고 다음 변수들을 넣어줍니다.

```bash
STRAPI_URL=
STRAPI_API_TOKEN=
CITY_DATA_FOLDER=
```

### To run

```bash
npm run build
npm start
```

### Description

1. 실행되면 CITY_DATA_FOLDER 폴더 하위의 cities.csv 파일이 있는지 검사하여 읽어옵니다.
1. 읽어온 데이터를 기반으로 이미지경로가 있는 데이터를 가져와서 data/city_updated_at.txt 파일의 기준날짜를 가져와 비교하여 해당 날짜보다 나중에 업데이트 된 데이터를 처리합니다.
1. 처리가 종료되면 기준날짜를 오늘날짜로 저장합니다.
1. 다시 실행되면 기준날짜가 바뀌었으므로 이미 업로드한 이미지는 업로드 하지 않습니다.
