import SERVICES from "./services";
import "./index.css";
import { debounce } from "debounce";
import { IconAddBorder } from "@codexteam/icons";

export default class Embed {
  static get toolbox() {
    return {
      icon: IconAddBorder,
      title: "Embed",
    };
  }

  constructor({ data, api, config, readOnly }) {
    this.api = api;
    this.config = config || {};
    this._data = {};
    this.element = null;
    this.readOnly = readOnly;

    this.data = data;
  }

  set data(data) {
    if (!(data instanceof Object)) {
      throw Error("Embed Tool data should be object");
    }

    const { service, source, embed, width, height, caption = "" } = data;

    this._data = {
      service: service || this.data.service || "",
      source: source || this.data.source || "",
      embed: embed || this.data.embed || "",
      width: width || this.data.width,
      height: height || this.data.height,
      caption: caption || this.data.caption || "",
    };

    const oldView = this.element;

    if (oldView) {
      oldView.parentNode.replaceChild(this.render(), oldView);
    }
  }

  get data() {
    if (this.element) {
      const caption = this.element.querySelector(`.${this.api.styles.input}`);

      this._data.caption = caption ? caption.innerHTML : "";
    }

    return this._data;
  }

  get CSS() {
    return {
      baseClass: this.api.styles.block,
      input: this.api.styles.input,
      container: "embed-tool",
      containerLoading: "embed-tool--loading",
      preloader: "embed-tool__preloader",
      caption: "embed-tool__caption",
      url: "embed-tool__url",
      content: "embed-tool__content",
    };
  }

  render() {
    if (!this.data.service) {
      // const container = document.createElement("div");
      // this.element = container;
      // return container;

      const container = document.createElement("div");
      container.classList.add(this.api.styles.block);

      const input = document.createElement("input");
      input.classList.add(this.api.styles.input);
      input.placeholder = this.api.i18n.t(
        this.config.placeholder || "Paste a url"
      );
      input.value = this.data && this.data.source ? this.data.source : "";

      input.addEventListener("paste", (event) => {
        this._setUrl(event.clipboardData.getData("text"));
      });

      container.appendChild(input);

      this.element = container;
      return container;
    }

    const { html } = Embed.services[this.data.service];
    const container = document.createElement("div");
    const caption = document.createElement("div");
    const template = document.createElement("template");
    const preloader = this.createPreloader();

    container.classList.add(
      this.CSS.baseClass,
      this.CSS.container,
      this.CSS.containerLoading
    );
    caption.classList.add(this.CSS.input, this.CSS.caption);

    container.appendChild(preloader);

    caption.contentEditable = !this.readOnly;
    caption.dataset.placeholder = this.api.i18n.t("Enter a caption");
    caption.innerHTML = this.data.caption || "";

    template.innerHTML = html;
    template.content.firstChild.setAttribute("src", this.data.embed);
    template.content.firstChild.classList.add(this.CSS.content);

    const embedIsReady = this.embedIsReady(container);

    container.appendChild(template.content.firstChild);
    container.appendChild(caption);

    embedIsReady.then(() => {
      container.classList.remove(this.CSS.containerLoading);
    });

    this.element = container;

    return container;
  }

  createPreloader() {
    const preloader = document.createElement("preloader");
    const url = document.createElement("div");

    url.textContent = this.data.source;

    preloader.classList.add(this.CSS.preloader);
    url.classList.add(this.CSS.url);

    preloader.appendChild(url);

    return preloader;
  }

  save() {
    return this.data;
  }
  _setUrl(urlText) {
    // get the service and the url out of the urlText provided
    const service = this.getSecondLevelDomain(urlText);
    const url = urlText;
    // const { key: service, data: url } = urlText;

    const {
      regex,
      embedUrl,
      width,
      height,
      id = (ids) => ids.shift(),
    } = Embed.services[service];
    const result = regex.exec(url).slice(1);
    const embed = embedUrl.replace(/<%= remote_id %>/g, id(result));

    this.data = {
      service,
      source: url,
      embed,
      width,
      height,
    };
  }

  onPaste(event) {
    const { key: service, data: url } = event.detail;

    const {
      regex,
      embedUrl,
      width,
      height,
      id = (ids) => ids.shift(),
    } = Embed.services[service];
    const result = regex.exec(url).slice(1);
    const embed = embedUrl.replace(/<%= remote_id %>/g, id(result));

    this.data = {
      service,
      source: url,
      embed,
      width,
      height,
    };
  }

  static prepare({ config = {} }) {
    const { services = {} } = config;

    let entries = Object.entries(SERVICES);

    const enabledServices = Object.entries(services)
      .filter(([key, value]) => {
        return typeof value === "boolean" && value === true;
      })
      .map(([key]) => key);

    const userServices = Object.entries(services)
      .filter(([key, value]) => {
        return typeof value === "object";
      })
      .filter(([key, service]) => Embed.checkServiceConfig(service))
      .map(([key, service]) => {
        const { regex, embedUrl, html, height, width, id } = service;

        return [
          key,
          {
            regex,
            embedUrl,
            html,
            height,
            width,
            id,
          },
        ];
      });

    if (enabledServices.length) {
      entries = entries.filter(([key]) => enabledServices.includes(key));
    }

    entries = entries.concat(userServices);

    Embed.services = entries.reduce((result, [key, service]) => {
      if (!(key in result)) {
        result[key] = service;

        return result;
      }

      result[key] = Object.assign({}, result[key], service);

      return result;
    }, {});

    Embed.patterns = entries.reduce((result, [key, item]) => {
      result[key] = item.regex;

      return result;
    }, {});
  }

  static checkServiceConfig(config) {
    const { regex, embedUrl, html, height, width, id } = config;

    let isValid =
      regex &&
      regex instanceof RegExp &&
      embedUrl &&
      typeof embedUrl === "string" &&
      html &&
      typeof html === "string";

    isValid = isValid && (id !== undefined ? id instanceof Function : true);
    isValid =
      isValid && (height !== undefined ? Number.isFinite(height) : true);
    isValid = isValid && (width !== undefined ? Number.isFinite(width) : true);

    return isValid;
  }

  static get pasteConfig() {
    return {
      patterns: Embed.patterns,
    };
  }

  static get isReadOnlySupported() {
    return true;
  }

  embedIsReady(targetNode) {
    const PRELOADER_DELAY = 450;

    let observer = null;

    return new Promise((resolve, reject) => {
      observer = new MutationObserver(debounce(resolve, PRELOADER_DELAY));
      observer.observe(targetNode, {
        childList: true,
        subtree: true,
      });
    }).then(() => {
      observer.disconnect();
    });
  }

  getSecondLevelDomain(url) {
    var anchor = document.createElement("a");
    anchor.href = url;

    // Extract the hostname from the URL
    var hostname = anchor.hostname;

    // Split the hostname into parts
    var parts = hostname.split(".");

    // Check if the URL has an IP address or a domain without subdomains
    if (parts.length === 1) {
      return hostname; // Return the hostname as it is (likely an IP address)
    } else if (parts.length === 2) {
      return parts[0]; // Return only the domain name without TLD
    }

    // Return the second-level domain without TLD
    return parts[parts.length - 2];
  }

  validate(savedData) {
    if (!savedData.service.trim()) {
      return false;
    }
    if (!savedData.source.trim()) {
      return false;
    }
    if (!savedData.embed.trim()) {
      return false;
    }

    return true;
  }
}
