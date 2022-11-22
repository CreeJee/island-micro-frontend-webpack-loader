# project

## react-host
- [x] Shadow Dom (css-isolation)
- [x] webpack module federation
- [x] React Lazy + Suspense
    - [ ] support custom loading bar
- [x] Support emotion/cache 
    - [ ] set custom cache key
- [ ] export web-components 
    ```html
        <island-react url="" scope="" module=""/>
    ```
- [ ] use react-components
    - [ ] inject 
        - [ ] style,
        - [ ] classname
    - [ ] react ref 

## react-remote
- [x] split global-css & shadow-dom css
    - global 
        - @font-face
        - @import
    - local 
        - bundled css
- [x] css @import preprocessing
- [ ] setup for create-react-app
