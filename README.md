## TorrServer Adder  
Расширение для десктопных браузеров **Google Chrome** и **Mozilla Firefox** позволяющее добавлять торренты с торрент-трекеров на [**TorrServer**](https://github.com/YouROK/TorrServer) и воспроизводить их с помощью системного медиаплеера.
> Для работы расширения **!!! НЕОБХОДИМ TORRSERVER !!!** запущенный на локальной машине или в сети (например из клиентского приложения [**TorrServe**](https://github.com/YouROK/TorrServe) в Android или с использованием [**TorrServer Launcher**](https://github.com/Noperkot/TSL) в Windows).  

#### Функционал
- Команды контекстного меню (ПКМ на торрент- или магнет-ссылке):  
  - **Добавить на TorrServer** — торрент будет добавлен на сервер и станет доступен для воспроизведения клиентами  

  - **Добавить и воспроизвести** — торрент также добавляется на сервер, после чего браузер скачивает с сервера плейлист добавленного торрента и открывает его в медиаплеере ПК для воспроизведения  

  - **Воспроизвести без добавления** — аналогична предыдущей команде, но после воспроизведения торрент будет удален с сервера   

- Перехват magnet-ссылок (по клику на ссылке выполняется действие заданное в настройках дополнения)  
- Вместе с торрентом на сервер по возможности передается его постер и название (только для определенных торрент-трекеров, список в справке расширения)  
- Система профилей - возможность хранения нескольких независимых наборов настроек. Переключение профилей производится по ЛКМ на иконке расширения  
- Поддержа авторизации  
- На странице торрента в КИНОЗАЛ.ТВ отображается magnet-ссылка (только для зарегистрированных на сервисе пользователей)  
- Очистка следов в истории загрузок браузера (не будет засоряться скачанными при воспроизведении плейлистами)(только для Chrome)  
- Поддерживаемые версии TorrServer: **MatriX, 1.2, 1.1**  

#### Настройка  
-   Убедитесь, что **TorrServer запущен** и в браузере открывается его веб-итерфейс. Последнюю версию сервера под вашу платформу можно взять  [**здесь**](https://github.com/YouROK/TorrServer/releases/latest).  
-   Для воспроизведения необходимо, чтобы ваш медиаплеер был ассоциирован с файлами **\*.m3u**  
-   После установки расширения в его настройках укажите сетевой адрес вашего TorrServer'а. Например  **http:<area>//torrserver.lan:8090**  или  **http:<area>//localhost:8090**  (если сервер запущен на том же хосте, что и браузер).  
    Вместо имени можно использовать IP-адрес ( пример -  **http:<area>//192.168.1.123:8090**  ).  
    Для **авторизации** (если используется сервером) url должен содержать имя и пароль ( пример -  **http:<area>//username:password@192.168.1.123:8090**  ).  
-   Выберите действие выполняемое при клике на magnet-ссылке.  
-	В Chrome флаг очистки списка загрузок устанавливать  **только после того, как вы убедитесь, что при воспроизведении плеер подхватывает плейлист без запроса браузера**  (при включенной опции будет невозможно выполнить следующий пункт)
-	Чтобы при воспроизведении браузер каждый раз не запрашивал подтверждение на открытие файла плейлиста необходимо:  
	-	**Chrome и Firefox >= 98**:	после первой загрузки(воспроизведения) в списке закачек браузера из контекстного меню (ПКМ на скачанном  **.m3u**  файле) выбрать пункт  **"Всегда открывать файлы этого типа"**  (местонахождение этой опции может варьироваться в зависимости от версии браузера).  
			
	-	**Firefox < 98**:	установить дополнение [InlineDisposition Reloaded](https://addons.mozilla.org/firefox/addon/inlinedisposition-reloaded/). Первые пару раз браузер все же может запросить подтверждение — согласиться. Или спросить в каком приложении открыть файл — выбрать ваш медиаплеер.  

- <details><summary>Дополнительные настройки только для Tor Browser</summary>
	
	-   В качестве адреса TorrServer необходимо указывать **IP-адрес**.
		
	-   Нужно отключить прокси для торрсервера (иначе браузер будет пытаться подключиться к серверу через tor). В браузере перейти на страницу **about:config** (вставить в адресную строку), в строке поиска ввести **network.proxy.no_proxies_on** -> задать IP-адрес вашего TorrServer (**x.x.x.x** для адреса в сети или **127.0.0.1** если сервер работает на том же хосте, что и браузер). После этой операции в браузере должен стать доступен веб-интерфейс сервера (**http:<area>//x.x.x.x:8090**)
		
</details>


#### Установка/обновление из магазинов браузеров:
-   [**Chrome**](https://chrome.google.com/webstore/detail/torrserver-adder/ihphookhabmjbgccflngglmidjloeefg)  
-   [**Firefox**](https://addons.mozilla.org/firefox/addon/torrserver-adder)

#### Обсуждение TorrServer'а и всего, что с ним связано:

-   [**на 4PDA**](https://4pda.to/forum/index.php?showtopic=889960)
-   [**в Telegram**](https://t.me/TorrServe)

Видео [**как это работает**](https://www.youtube.com/watch?v=7e5mwleqxvM)

<details><summary><b>Скриншоты</b></summary>  

***
![](/screenshots/screen1.jpg?raw=true)  
***
![](/screenshots/screen2.jpg?raw=true)  
***
![](/screenshots/screen3.png?raw=true)  
***
</details>
