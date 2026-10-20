# Third-party notices

horse2pdf bundles or uses the following third-party components. Their licenses apply in
addition to horse2pdf's own [MIT license](LICENSE).

## Shipped with the application

| Component | Use | License |
| --------- | --- | ------- |
| [SaxonJS 2.7](https://www.saxonica.com/saxonjs/) (downloaded at build time) | XSLT runtime for validation | Saxonica license, see below |
| [EN 16931 validation artefacts](https://github.com/ConnectingEurope/eInvoicing-EN16931) (CEN/TC 434), compiled | Validation rules | EUPL-1.2 |
| [XRechnung Schematron](https://github.com/itplr-kosit/xrechnung-schematron) (KoSIT), compiled | Validation rules | Apache-2.0 |
| [Peppol BIS Billing 3.0 rules](https://github.com/OpenPEPPOL/peppol-bis-invoice-3) (OpenPEPPOL), compiled | Validation rules | see upstream; reproduced with permission from CEN as stated in the rule files |
| [pdf.js](https://github.com/mozilla/pdf.js) | Reading ZUGFeRD PDFs, rendering pages | Apache-2.0 |
| [pdfmake](https://github.com/bpampuch/pdfmake) / [PDFKit](https://github.com/foliojs/pdfkit) | PDF export | MIT |
| [Roboto](https://fonts.google.com/specimen/Roboto) (via pdfmake) | Font embedded in exported PDFs | Apache-2.0 |
| [React](https://react.dev) | UI | MIT |
| [lucide](https://lucide.dev) | Icons | ISC |
| [qrcode](https://github.com/soldair/node-qrcode) | GiroCode | MIT |
| [@xmldom/xmldom](https://github.com/xmldom/xmldom) | XML parsing | MIT |
| [Tauri](https://tauri.app) and its plugins | Desktop shell | MIT / Apache-2.0 |

## Build time only

| Component | Use | License |
| --------- | --- | ------- |
| [SchXslt](https://codeberg.org/SchXslt/schxslt) | Schematron → XSLT compiler | MIT |
| [xslt3](https://www.npmjs.com/package/xslt3) (Saxonica) | XSLT → SEF compiler | Saxonica license |
| [KoSIT xrechnung-visualization](https://github.com/itplr-kosit/xrechnung-visualization) | Test oracle (not shipped) | Apache-2.0 |

## Test fixtures

See [tests/fixtures/README.md](tests/fixtures/README.md) (KoSIT test suite, CEN and Peppol
examples, ZUGFeRD corpus – each with its license file).

## SaxonJS

SaxonJS is © Saxonica Ltd. Its browser runtime (`SaxonJS2.rt.js`) is **not** stored in this
repository; the build downloads the pinned, hash-verified release from saxonica.com
(`rules/sources.json`) and ships it unmodified, together with its `LICENSE.txt`, inside the
application bundle, as permitted by the Saxonica license (version 1.0, June 2020):

> Copyright: The copyright in the Software belongs to Saxonica Ltd, except for third-party
> components listed in the documentation that are distributed under license.
>
> DISCLAIMER. THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS." ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDERS OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
