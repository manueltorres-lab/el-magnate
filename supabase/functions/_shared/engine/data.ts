// COPIA de /engine generada por scripts/sync-engine.mjs. No editar acá.
// ARCHIVO GENERADO por scripts/extract-data.mjs a partir de
// handoff/referencia/El Magnate.dc.html. No editar a mano: los números están calibrados.
import type {
  Tag, Risk, Scenario, Option, QuizQuestion, BagMiniKind, AutoEvent, ChoiceEvent, TitleKey, Title,
} from './types.ts';

export const TAG_LABEL: Record<Tag, string> = {conservative:'Conservador', moderate:'Moderado', aggressive:'Agresivo', business:'Emprendedor', debt:'Apalancado', realestate:'Ladrillo', education:'Estudioso', networking:'Bien conectado', philanthropy:'Solidario', consumption:'Disfrutón'};

export const TAG_EFFECT: Record<Tag, { rep: number; calma: number }> = {
  conservative:{rep:0, calma:5}, moderate:{rep:1, calma:1}, aggressive:{rep:2, calma:-8},
  business:{rep:3, calma:-5}, debt:{rep:1, calma:-10}, realestate:{rep:2, calma:2},
  education:{rep:4, calma:3}, networking:{rep:5, calma:-2}, philanthropy:{rep:6, calma:6},
  consumption:{rep:-7, calma:14}
};

export const COMMIT: Record<Risk, number> = {baja:0.2, media:0.5, alta:0.85};

export const BIG_THRESHOLD: number = 15000000;

export const BIG_SCENARIOS: readonly Scenario[] = [
  {icon:"🔔", eyebrow:"Grandes ligas · IPO", text:"Tu empresa puede salir a la bolsa.",
   detail:"Abrir el capital al mercado te puede hacer millonario de un saque, o exponerte como nunca antes.",
   options:[
    {label:"Sacás la empresa a la bolsa", icon:"🔔", tag:"business", risk:"alta", min:-70, max:115, desc:"El día más caro de tu vida, para un lado o el otro."},
    {label:"Vendés una parte a un fondo", icon:"🤝", tag:"networking", risk:"media", min:-30, max:75, desc:"Menos ruido, plata segura arriba de la mesa."},
    {label:"Te la quedás entera", icon:"🔒", tag:"conservative", risk:"baja", min:4, max:14, desc:"Sin socios, sin apuro."}]},
  {icon:"🏛️", eyebrow:"Grandes ligas · Fondo propio", text:"Podés armar tu propio fondo y manejar plata de terceros.",
   detail:"Cobrás comisiones sobre un capital mucho más grande que el tuyo. Si sale mal, la que se quema es tu reputación.",
   options:[
    {label:"Levantás capital y abrís el fondo", icon:"🏛️", tag:"networking", risk:"alta", min:-60, max:100, desc:"Manejás plata ajena, cobrás sobre todo."},
    {label:"Armás un club de inversión chico", icon:"👥", tag:"business", risk:"media", min:-30, max:66, desc:"Pocos socios, riesgo controlado."},
    {label:"Seguís administrando solo lo tuyo", icon:"🧍", tag:"conservative", risk:"baja", min:4, max:12, desc:"Cero explicaciones para dar."}]},
  {icon:"🏢", eyebrow:"Grandes ligas · Ladrillo", text:"Aparece un edificio entero en venta, a precio de oportunidad.",
   detail:"Es la operación más grande que te tocó mirar. Inmoviliza casi todo, pero cambia tu escala para siempre.",
   options:[
    {label:"Comprás el edificio completo", icon:"🏢", tag:"realestate", risk:"alta", min:-55, max:86, desc:"Todo tu capital en una escritura."},
    {label:"Comprás medio piso y alquilás", icon:"🔑", tag:"realestate", risk:"media", min:-25, max:57, desc:"Renta firme, crecimiento lento."},
    {label:"Pasás, es demasiado", icon:"🙅", tag:"conservative", risk:"baja", min:3, max:10, desc:"No todo lo grande es para vos."}]},
  {icon:"⚙️", eyebrow:"Grandes ligas · Derivados", text:"Con tu capital ya podés operar derivados apalancados en serio.",
   detail:"El apalancamiento no tiene techo, y tampoco tiene piso. Acá se hacen y se deshacen fortunas en un trimestre.",
   options:[
    {label:"Apalancás toda la cartera", icon:"⚙️", tag:"debt", risk:"alta", min:-100, max:153, desc:"El techo es enorme. El piso es cero."},
    {label:"Apalancás una parte y cubrís el resto", icon:"🛡️", tag:"moderate", risk:"media", min:-35, max:73, desc:"Vértigo controlado."},
    {label:"Nada de derivados", icon:"🙅", tag:"conservative", risk:"baja", min:3, max:9, desc:"Ya ganaste bastante."}]},
  {icon:"🦈", eyebrow:"Grandes ligas · Adquisición", text:"Podés comprar a tu competencia más chica.",
   detail:"Te quedás con su mercado de un día para el otro. También con sus problemas.",
   options:[
    {label:"Comprás la competencia", icon:"🦈", tag:"business", risk:"alta", min:-75, max:110, desc:"Te quedás con toda la torta."},
    {label:"Hacés una alianza en vez de comprar", icon:"🤝", tag:"networking", risk:"media", min:-25, max:59, desc:"Comparten mercado, comparten riesgo."},
    {label:"Los dejás ser", icon:"😌", tag:"conservative", risk:"baja", min:3, max:10, desc:"Cada uno en su rubro."}]}
];

export const DESESPERADAS: readonly Option[] = [
  {label:"Vas por todo con lo que te queda", icon:"🎲", tag:"aggressive", risk:"alta", min:-100, max:118, desc:"No lo pensás. Empujás todas las fichas de una.", extra:"ahogado"},
  {label:"Pedís plata prestada para recuperarte", icon:"⚡", tag:"debt", risk:"alta", min:-100, max:122, desc:"Recuperar lo perdido, sea como sea y a quien sea.", extra:"ahogado"},
  {label:"Liquidás todo y apostás a una sola carta", icon:"🃏", tag:"aggressive", risk:"alta", min:-100, max:115, desc:"Una jugada, una sola, y que decida el destino.", extra:"ahogado"}
];

export const FINAS: readonly Option[] = [
  {label:"Esperás el momento justo y entrás quirúrgico", icon:"🎯", tag:"moderate", risk:"media", min:-18, max:42, desc:"Viste algo que con la cabeza cansada no se ve.", extra:"fina"},
  {label:"Negociás mejores condiciones antes de entrar", icon:"🤝", tag:"networking", risk:"media", min:-16, max:40, desc:"La calma te da margen para pedir más.", extra:"fina"},
  {label:"Armás la posición de a poco, sin apuro", icon:"📐", tag:"moderate", risk:"media", min:-15, max:38, desc:"Promediás la entrada como un profesional.", extra:"fina"}
];

export const CALMA_BAJA = 30, CALMA_ALTA = 70;

export const SLOT_SYMBOLS: readonly string[] = ['🍒','🍋','⭐','💎','🍀','🔔'];

export const RULETA: readonly { mult: number; label: string }[] = [
  {mult:0,   label:'Nada'},  {mult:1.5, label:'×1,5'}, {mult:0.5, label:'×0,5'}, {mult:3, label:'×3'},
  {mult:0,   label:'Nada'},  {mult:2,   label:'×2'},   {mult:0.5, label:'×0,5'}, {mult:0, label:'Nada'}
];

export const QUIZ: readonly QuizQuestion[] = [
  {q:"Cuando se cayó el uno a uno, ¿a cuánto se fue el dólar en pocos meses?", opts:["Se quedó casi igual","Al triple","A la mitad"], ok:1,
   why:"De un peso por dólar pasó a rondar los tres. El que tenía deuda en dólares y sueldo en pesos se despertó debiendo el triple."},
  {q:"El corralito, ¿qué te impedía hacer?", opts:["Comprar en cuotas","Sacar tu propia plata del banco","Pagar impuestos"], ok:1,
   why:"Podías ver el saldo en la cuenta, pero no retirarlo. Tu plata existía en la pantalla y no en tu bolsillo."},
  {q:"¿Qué mide el riesgo país?", opts:["Cuánto interés extra te exigen para prestarte","La inflación del mes","El precio del dólar"], ok:0,
   why:"Es la sobretasa por encima de lo que paga Estados Unidos. Cuanto más alto, más caro te sale conseguir plata prestada."},
  {q:"Un crédito UVA ajusta la cuota por…", opts:["El precio del dólar","La inflación","La tasa de Estados Unidos"], ok:1,
   why:"La cuota sigue a la inflación. Si tu sueldo corre más lento que los precios, la cuota se te va arriba."},
  {q:"\"Reperfilar\" un vencimiento es, en criollo…", opts:["Pagar antes","Pagar más","No pagar en fecha"], ok:2,
   why:"Es correr la fecha de pago y ponerle un nombre elegante. El que esperaba cobrar, espera más."},
  {q:"En el canje de deuda con quita, los acreedores…", opts:["Cobraron el doble","Cobraron una parte y firmaron igual","No cobraron nunca"], ok:1,
   why:"Aceptaron cobrar bastante menos de lo prestado. Entre algo y nada, la mayoría eligió algo."},
  {q:"¿Qué fue el Efecto Tequila?", opts:["Una crisis que arrancó en México","Un boom del agro","Una devaluación brasileña"], ok:0,
   why:"México devaluó a fines del 94 y el susto se contagió a toda la región. Lección: la crisis del vecino también es tuya."},
  {q:"La burbuja de las puntocom explotó porque…", opts:["Subió el petróleo","Las empresas de internet valían mucho más de lo que producían","Cerraron los bancos"], ok:1,
   why:"Se pagaban fortunas por empresas sin ganancias, solo por la promesa. Cuando la promesa no llegó, el precio volvió a la tierra."},
  {q:"En 2020 el petróleo llegó a cotizar…", opts:["En negativo","A mil dólares","Igual que el oro"], ok:0,
   why:"Con el mundo parado no había dónde guardarlo: pagaban por sacártelo de encima. Un precio puede ir más abajo que cero."},
  {q:"La crisis de 2008 arrancó por…", opts:["Hipotecas que no se podían pagar","Una guerra","Un default argentino"], ok:0,
   why:"Se prestó para casas a gente que no podía pagar y se empaquetó esa deuda como si fuera segura. Cuando dejaron de pagar, cayó todo el paquete."},
  {q:"El cepo cambiario es…", opts:["Un impuesto al cheque","Un límite para comprar dólares","Un tipo de plazo fijo"], ok:1,
   why:"Es un tope a cuántos dólares podés comprar. Donde hay cepo suele aparecer un precio paralelo."},
  {q:"Si tu plazo fijo paga menos que la inflación…", opts:["Ganás plata","Perdés poder de compra","Da lo mismo"], ok:1,
   why:"Terminás con más pesos que compran menos cosas. El número sube y tu vida no."},
  {q:"El interés compuesto es…", opts:["Ganar interés sobre los intereses que ya ganaste","Pagar dos veces","Un impuesto"], ok:0,
   why:"Los intereses se suman al capital y empiezan a generar los suyos. Juega a tu favor si invertís y en contra si debés."},
  {q:"Diversificar la cartera sirve para…", opts:["Ganar siempre","Que un solo golpe no te funda","Pagar menos impuestos"], ok:1,
   why:"No evita perder: evita perder todo junto. Es el único almuerzo gratis que hay."}
];

export const QUIZ_PCT: readonly number[] = [0.05, 0.08, 0.13];

export const MINI_KINDS: readonly BagMiniKind[] = ['slots','doble','sobres','ruleta'];

export const CARD_R: readonly string[] = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

export const CARD_S: readonly string[] = ['♠','♥','♦','♣'];

export const SCENARIOS: readonly Scenario[] = [
  {icon:"💰", eyebrow:"Ahorro extra", text:"Te sobró plata este mes. ¿Qué hacés con ella?",
   detail:"Nada te obliga a moverla ya, pero dejarla parada tampoco construye nada.",
   options:[
    {label:"Plazo fijo", icon:"🏦", tag:"conservative", risk:"baja", min:3, max:9, desc:"Rendimiento chico, pero seguro."},
    {label:"Fondo diversificado", icon:"📊", tag:"moderate", risk:"media", min:-40, max:45, desc:"Mezclás activos, mezclás resultados."},
    {label:"Todo en una cripto nueva", icon:"🚀", tag:"aggressive", risk:"alta", min:-85, max:102, desc:"Puede duplicarse o desaparecer."}]},
  {icon:"🏗️", eyebrow:"Emprendimiento", text:"Un amigo te propone sumarte a su emprendimiento.",
   detail:"Confiás en él, pero un emprendimiento nuevo puede fundirse tan rápido como puede despegar.",
   options:[
    {label:"Invertís fuerte y te sumás de lleno", icon:"🏗️", tag:"business", risk:"alta", min:-85, max:108, desc:"Todo o nada, con él."},
    {label:"Invertís una parte chica para probar", icon:"🌱", tag:"moderate", risk:"media", min:-35, max:44, desc:"Testeás sin comprometerte del todo."},
    {label:"Preferís no arriesgar y ahorrás", icon:"💰", tag:"conservative", risk:"baja", min:3, max:6, desc:"Guardás la plata en la tuya."}]},
  {icon:"🏦", eyebrow:"Crédito", text:"El banco te ofrece un préstamo a tasa baja.",
   detail:"Tomar deuda multiplica lo que podés invertir, y también lo que podés perder.",
   options:[
    {label:"Lo tomás para invertir más fuerte", icon:"📈", tag:"debt", risk:"alta", min:-100, max:115, desc:"Apalancado, para bien o para mal."},
    {label:"Lo usás para comprar una propiedad", icon:"🏠", tag:"realestate", risk:"media", min:-30, max:37, desc:"Ladrillo, más lento pero más firme."},
    {label:"Rechazás el préstamo", icon:"🙅", tag:"conservative", risk:"baja", min:2, max:5, desc:"Sin deuda, sin drama."}]},
  {icon:"📚", eyebrow:"Formación", text:"Te ofrecen un curso caro de especialización financiera.",
   detail:"Invertir en vos mismo no siempre se nota en la cuenta al toque.",
   options:[
    {label:"Invertís en tu formación", icon:"📚", tag:"education", risk:"media", min:-25, max:32, desc:"Apuesta a largo plazo, a vos."},
    {label:"Preferís poner esa plata en el mercado", icon:"📊", tag:"moderate", risk:"media", min:-35, max:42, desc:"Mismo riesgo, otro destino."},
    {label:"Ahorrás el dinero", icon:"💰", tag:"conservative", risk:"baja", min:3, max:6, desc:"Lo dejás guardado, nomás."}]},
  {icon:"🎰", eyebrow:"Tip de un conocido", text:"Te hablan de una 'oportunidad única' con retorno garantizado.",
   detail:"Nadie te garantiza nada de verdad. Si suena demasiado bueno para ser cierto, probablemente lo sea.",
   options:[
    {label:"Metés todo lo que tenés", icon:"🎰", tag:"aggressive", risk:"alta", min:-110, max:128, desc:"Confiaste a ciegas."},
    {label:"Metés solo una parte chica", icon:"🤔", tag:"moderate", risk:"media", min:-45, max:50, desc:"Probás sin comprometer todo."},
    {label:"No confiás y lo ignorás", icon:"🚫", tag:"conservative", risk:"baja", min:1, max:4, desc:"El instinto te salva."}]},
  {icon:"🤝", eyebrow:"Sociedad", text:"Podés asociarte con otro inversor para un proyecto más grande.",
   detail:"De a dos se llega más lejos, pero hay más en juego y más de quién depender.",
   options:[
    {label:"Formás sociedad 50/50", icon:"🤝", tag:"networking", risk:"media", min:-40, max:49, desc:"Ganás y perdés acompañado."},
    {label:"Preferís seguir solo", icon:"🧍", tag:"conservative", risk:"baja", min:2, max:8, desc:"Menos techo, menos riesgo."}]},
  {icon:"🛍️", eyebrow:"Aguinaldo", text:"Te entra el aguinaldo completo, de golpe.",
   detail:"Lo que hagas con este extra dice bastante de qué tipo de inversor sos.",
   options:[
    {label:"Te lo gastás en algo para vos", icon:"🛍️", tag:"consumption", risk:"baja", spend:true, desc:"Te lo merecés, dice una parte tuya."},
    {label:"Lo reinvertís todo", icon:"📈", tag:"moderate", risk:"media", min:-35, max:42, desc:"Todo adentro, otra vez."},
    {label:"Donás una parte a una causa", icon:"❤️", tag:"philanthropy", risk:"baja", min:-20, max:-6, desc:"Menos para vos, más para otros."}]},
  {icon:"🏠", eyebrow:"Bienes raíces", text:"El mercado inmobiliario está en alza.",
   detail:"El ladrillo se mueve lento, pero cuando sube, sube en serio.",
   options:[
    {label:"Comprás una propiedad", icon:"🏠", tag:"realestate", risk:"media", min:-25, max:39, desc:"Inmoviliza plata, pero rinde."},
    {label:"Invertís en un fondo inmobiliario", icon:"🏢", tag:"moderate", risk:"media", min:-30, max:37, desc:"Ladrillo sin comprar ladrillo."},
    {label:"Esperás un mejor momento", icon:"⏳", tag:"conservative", risk:"baja", min:1, max:4, desc:"Total, no corre nadie."},
    {label:"Comprás dos con crédito puente", icon:"⚡", tag:"debt", risk:"alta", min:-85, max:93, desc:"Duplicás la apuesta con plata prestada."}]},
  {icon:"🚀", eyebrow:"Hype digital", text:"Aparece una nueva moneda digital muy hypeada en redes.",
   detail:"El hype no es lo mismo que el valor real. A veces coinciden, a veces explotan juntos.",
   options:[
    {label:"Invertís fuerte", icon:"🚀", tag:"aggressive", risk:"alta", min:-100, max:124, desc:"Subiste (o bajaste) al cohete."},
    {label:"Invertís algo chico para probar", icon:"🪙", tag:"moderate", risk:"media", min:-45, max:52, desc:"Una ficha, no todas."},
    {label:"No participás", icon:"🙅", tag:"conservative", risk:"baja", min:1, max:4, desc:"Dejás pasar el hype."}]},
  {icon:"🎤", eyebrow:"Mentoría", text:"Te ofrecen ser mentor de inversores nuevos a cambio de honorarios.",
   detail:"Compartir lo que sabés te da un ingreso extra, aunque te saque tiempo de tus propias jugadas.",
   options:[
    {label:"Aceptás", icon:"🎤", tag:"networking", risk:"media", min:-15, max:22, desc:"Menos tiempo, más contactos."},
    {label:"Preferís enfocarte en lo tuyo", icon:"🎯", tag:"conservative", risk:"baja", min:2, max:6, desc:"Foco total en tu plata."},
    {label:"Armás un curso pago y lo vendés en masa", icon:"📣", tag:"business", risk:"alta", min:-78, max:86, desc:"Escalás tu nombre, con todo lo que eso trae."}]},
  {icon:"📊", eyebrow:"Bolsa", text:"La bolsa está en un buen momento.",
   detail:"Cuando todo sube, la tentación es concentrar. Cuando baja, esa decisión sale carísima.",
   options:[
    {label:"Diversificás en varias acciones", icon:"📊", tag:"moderate", risk:"media", min:-35, max:42, desc:"Repartís el golpe si llega."},
    {label:"Concentrás todo en una acción prometedora", icon:"🎯", tag:"aggressive", risk:"alta", min:-95, max:112, desc:"Todas las fichas, un color."},
    {label:"Te quedás en efectivo por las dudas", icon:"💵", tag:"conservative", risk:"baja", min:1, max:3, desc:"Ni ganás ni perdés, casi."}]},
  {icon:"🚀", eyebrow:"Venture", text:"Te proponen ser inversor ángel de una startup.",
   detail:"La mayoría de las startups fracasan. Las pocas que funcionan, funcionan en serio.",
   options:[
    {label:"Invertís", icon:"🚀", tag:"business", risk:"alta", min:-110, max:137, desc:"Todo o (casi) nada."},
    {label:"Pasás", icon:"🙅", tag:"conservative", risk:"baja", min:2, max:5, desc:"Dejás pasar el boleto."}]},
  {icon:"🎓", eyebrow:"Asesoramiento", text:"Podés reestructurar tus ahorros con un asesor financiero.",
   detail:"Pagar por consejo profesional te puede ordenar la cabeza. O ser plata tirada.",
   options:[
    {label:"Contratás al asesor y seguís su plan", icon:"🎓", tag:"education", risk:"baja", min:2, max:8, desc:"Pagás por una segunda cabeza."},
    {label:"Escuchás, pero decidís vos", icon:"🧠", tag:"moderate", risk:"media", min:-30, max:37, desc:"Te queda la duda y la libertad."},
    {label:"Le pedís la cartera más ambiciosa", icon:"🔥", tag:"aggressive", risk:"alta", min:-85, max:105, desc:"Que ponga todo a trabajar fuerte."}]},
  {icon:"❤️", eyebrow:"Familia", text:"Un familiar necesita ayuda económica.",
   detail:"La familia no siempre entra en la planilla de excel.",
   options:[
    {label:"Lo ayudás sin esperar nada a cambio", icon:"❤️", tag:"philanthropy", risk:"baja", min:-30, max:-12, desc:"Perdés vos, gana la familia."},
    {label:"Le ofrecés un préstamo con interés", icon:"📃", tag:"business", risk:"media", min:-30, max:35, desc:"Ayuda, pero con condiciones."},
    {label:"No podés ayudar en este momento", icon:"🤷", tag:"conservative", risk:"baja", min:0, max:3, desc:"Cuidás lo tuyo primero."}]},
  {icon:"🏪", eyebrow:"Franquicia", text:"Te ofrecen comprar una franquicia conocida.",
   detail:"Una marca conocida no te salva si el rubro no acompaña. Es plata fuerte y atada.",
   options:[
    {label:"La comprás", icon:"🏪", tag:"business", risk:"alta", min:-95, max:115, desc:"Comprometés capital grande, ya."},
    {label:"Preferís invertir en otra cosa", icon:"📊", tag:"moderate", risk:"media", min:-30, max:37, desc:"Buscás algo más líquido."}]},
  {icon:"📰", eyebrow:"Tasas de interés", text:"Se empieza a hablar de una suba de tasas de interés.",
   detail:"Complica a los endeudados, pero abre oportunidades en renta fija.",
   options:[
    {label:"Pasás gran parte a instrumentos en dólares", icon:"💵", tag:"conservative", risk:"baja", min:3, max:9, desc:"Buscás refugio antes que nadie."},
    {label:"Reacomodás la cartera a la mitad", icon:"⚖️", tag:"moderate", risk:"media", min:-35, max:40, desc:"Ni te quedás quieto ni corrés."},
    {label:"Ignorás el rumor y seguís igual", icon:"🙉", tag:"aggressive", risk:"alta", min:-90, max:96, desc:"Apostás a que es ruido."}]},
  {icon:"📉", eyebrow:"Mercado laboral", text:"Hay una ola de despidos en tu sector.",
   detail:"Algunos frenan todo, otros ven la oportunidad de meterse cuando está barato.",
   options:[
    {label:"Armás un fondo de emergencia grande", icon:"🛟", tag:"conservative", risk:"baja", min:3, max:8, desc:"Dormís tranquilo, ganás poco."},
    {label:"Aprovechás para comprar activos baratos", icon:"🛒", tag:"aggressive", risk:"alta", min:-90, max:108, desc:"Comprás el miedo ajeno."},
    {label:"Seguís invirtiendo como si nada", icon:"😌", tag:"moderate", risk:"media", min:-35, max:40, desc:"No cambiás el plan."}]},
  {icon:"💵", eyebrow:"Cambio de divisas", text:"Necesitás pasar una parte de tus pesos a dólares.",
   detail:"El canal que elijas cambia el costo, la velocidad y el riesgo que asumís.",
   options:[
    {label:"Vas por el dólar oficial, formal", icon:"🏛️", tag:"conservative", risk:"baja", min:2, max:6, desc:"Más trámite, menos sobresalto."},
    {label:"Usás un dólar financiero (MEP)", icon:"📄", tag:"moderate", risk:"media", min:-20, max:27, desc:"Más rápido, algo más caro."},
    {label:"Le comprás a un arbolito de confianza", icon:"🌳", tag:"aggressive", risk:"alta", min:-100, max:90, desc:"Rápido, informal, sin recibo."}]},
  {icon:"📜", eyebrow:"Renta fija", text:"Te ofrecen bonos soberanos con muy buen rendimiento en papel.",
   detail:"El rendimiento alto casi siempre viene con historial de defaults.",
   options:[
    {label:"Comprás bonos de acá, a largo plazo", icon:"📜", tag:"aggressive", risk:"alta", min:-100, max:112, desc:"Rinden mucho si no vuelan por el aire."},
    {label:"Preferís bonos de un país más estable", icon:"🌍", tag:"moderate", risk:"media", min:-20, max:25, desc:"Menos rinde, menos susto."},
    {label:"Preferís no meterte en bonos", icon:"🙅", tag:"conservative", risk:"baja", min:2, max:5, desc:"Ya tenés bastante en la cabeza."}]},
  {icon:"📱", eyebrow:"Cedears", text:"Podés empezar a comprar Cedears de empresas grandes desde acá.",
   detail:"Exposición a compañías internacionales sin salir del país, con el dólar de por medio.",
   options:[
    {label:"Comprás Cedears de una tech grande", icon:"💻", tag:"aggressive", risk:"alta", min:-90, max:108, desc:"Apostás fuerte a un solo nombre."},
    {label:"Comprás un Cedear que sigue un índice", icon:"📈", tag:"moderate", risk:"media", min:-30, max:37, desc:"Repartido entre muchas empresas."},
    {label:"Te quedás afuera por ahora", icon:"🙅", tag:"conservative", risk:"baja", min:2, max:5, desc:"Preferís entender mejor primero."}]},
  {icon:"🖼️", eyebrow:"Coleccionables", text:"Te ofrecen entrar en una obra de arte junto a otros inversores.",
   detail:"Puede multiplicarse con los años, pero es difícil de vender rápido.",
   options:[
    {label:"Entrás en la obra de arte", icon:"🖼️", tag:"business", risk:"alta", min:-80, max:95, desc:"Linda en la pared, ilíquida en el bolsillo."},
    {label:"Preferís algo más fácil de vender", icon:"💧", tag:"moderate", risk:"media", min:-30, max:35, desc:"Menos romántico, más práctico."},
    {label:"Pasás de largo", icon:"🙅", tag:"conservative", risk:"baja", min:2, max:5, desc:"El arte no es lo tuyo."}]},
  {icon:"🪙", eyebrow:"Refugio de valor", text:"El oro está en boca de todos como refugio.",
   detail:"El activo más viejo del mundo para cuidarse. No te hace rico rápido, pero no desaparece.",
   options:[
    {label:"Comprás oro físico", icon:"🪙", tag:"realestate", risk:"media", min:-15, max:20, desc:"Lento, pero se mantiene firme."},
    {label:"Comprás un certificado de oro", icon:"📄", tag:"moderate", risk:"media", min:-18, max:23, desc:"Lo mismo, sin guardarlo en tu casa."},
    {label:"No le ves sentido ahora", icon:"🙅", tag:"conservative", risk:"baja", min:2, max:5, desc:"Preferís otra cosa."},
    {label:"Apalancás una posición grande en oro", icon:"⚡", tag:"debt", risk:"alta", min:-82, max:90, desc:"El refugio más viejo, con la palanca más nueva."}]},
  {icon:"🏨", eyebrow:"Alquiler temporario", text:"Podés convertir un departamento en alquiler temporario.",
   detail:"Rinde más que el tradicional, pero exige mucho más laburo y depende de la temporada.",
   options:[
    {label:"Lo metés en alquiler temporario", icon:"🏨", tag:"moderate", risk:"media", min:-35, max:46, desc:"Más renta, más trabajo, más vaivén."},
    {label:"Preferís el alquiler tradicional", icon:"🔑", tag:"conservative", risk:"baja", min:2, max:6, desc:"Menos renta, mucha más calma."},
    {label:"Vendés la propiedad de una", icon:"💵", tag:"aggressive", risk:"alta", min:-60, max:72, desc:"Liquidás todo, apostás a otra cosa."}]},
  {icon:"🛡️", eyebrow:"Seguro con ahorro", text:"Te ofrecen un seguro de vida con componente de ahorro.",
   detail:"Combina cobertura y ahorro, aunque casi siempre rinde menos que invertir por tu cuenta.",
   options:[
    {label:"Contratás el seguro con ahorro", icon:"🛡️", tag:"conservative", risk:"baja", min:2, max:5, desc:"Cobertura y ahorro, todo junto."},
    {label:"Preferís invertir esa plata vos mismo", icon:"📊", tag:"moderate", risk:"media", min:-30, max:37, desc:"Más manejo, más responsabilidad."}]},
  {icon:"🏖️", eyebrow:"Retiro", text:"Podés aportar extra a un fondo de retiro privado.",
   detail:"Es plata que no vas a tocar por años. ¿Cuánto de tu presente estás dispuesto a resignar?",
   options:[
    {label:"Aportás extra al fondo de retiro", icon:"🏖️", tag:"conservative", risk:"baja", min:2, max:6, desc:"Menos hoy, más tranquilidad después."},
    {label:"Preferís invertir vos mismo a largo plazo", icon:"📈", tag:"moderate", risk:"media", min:-30, max:37, desc:"Más control, más volantazo posible."},
    {label:"Preferís gastarlo en el presente", icon:"🛍️", tag:"consumption", risk:"baja", spend:true, desc:"El futuro que espere un poco."},
    {label:"Rescatás todo el retiro y lo jugás ahora", icon:"⚡", tag:"aggressive", risk:"alta", min:-92, max:100, desc:"Te comés la multa y apostás a llegar antes."}]},
  {icon:"🚗", eyebrow:"Vehículo productivo", text:"Podés comprar un auto para trabajar con aplicaciones.",
   detail:"Se deprecia con los kilómetros, pero puede generarte un ingreso extra todos los meses.",
   options:[
    {label:"Lo comprás de contado", icon:"🚗", tag:"realestate", risk:"media", min:-25, max:34, desc:"Capital inmovilizado, ingreso extra."},
    {label:"Lo financiás en cuotas", icon:"💳", tag:"debt", risk:"alta", min:-90, max:99, desc:"Menos plata ahora, más riesgo después."},
    {label:"Preferís no meterte en esto", icon:"🙅", tag:"conservative", risk:"baja", min:2, max:5, desc:"No es lo tuyo, y está bien."}]},
  {icon:"🐎", eyebrow:"Turf", text:"En el hipódromo te sugieren un caballo con muy buenas chances.",
   detail:"Esto no es inversión, es timba con patas de caballo.",
   options:[
    {label:"Apostás fuerte a ese caballo", icon:"🐎", tag:"aggressive", risk:"alta", min:-100, max:124, desc:"O ganás bien, o te quedás a pata."},
    {label:"Apostás una fichita, por las dudas", icon:"🎫", tag:"moderate", risk:"media", min:-50, max:55, desc:"Poca plata, la diversión completa."},
    {label:"Te quedás mirando la carrera", icon:"👀", tag:"conservative", risk:"baja", min:0, max:2, desc:"Disfrutás sin arriesgar nada."}]},
  {icon:"💪", eyebrow:"Networking fitness", text:"Un gurú del emprendedurismo te invita a su retiro de burpees y negocios.",
   detail:"Cinco días de entrenamiento, charlas motivacionales y gente que dice tener contactos. La entrada sale una fortuna.",
   options:[
    {label:"Pagás la entrada VIP y vas a todo", icon:"💪", tag:"networking", risk:"media", min:-30, max:37, desc:"Si hay un solo contacto bueno, se paga."},
    {label:"Vas un día, al panel gratis", icon:"🎟️", tag:"networking", risk:"baja", min:2, max:7, desc:"Escuchás sin dejar la tarjeta."},
    {label:"Te quedás laburando", icon:"🖥️", tag:"conservative", risk:"baja", min:2, max:5, desc:"Los burpees no pagan la luz."},
    {label:"Pagás la VIP y encima invertís en su fondo", icon:"🔥", tag:"aggressive", risk:"alta", min:-92, max:100, desc:"Te convenció del todo."}]},
  {icon:"🧘", eyebrow:"Coaching financiero", text:"Te ofrecen un curso de educación financiera con rendimientos garantizados.",
   detail:"Te muestran capturas de ganancias imposibles y te piden que sumes amigos para acceder al nivel de arriba. Algo no cierra.",
   options:[
    {label:"Entrás y sumás cuatro amigos", icon:"🔺", tag:"aggressive", risk:"alta", min:-100, max:108, desc:"Si es lo que dicen, sos el primero. Si no, arrastraste gente."},
    {label:"Entrás solo, con lo mínimo", icon:"🧘", tag:"debt", risk:"alta", min:-95, max:103, desc:"Probás con poco, por las dudas."},
    {label:"Pedís los papeles y te vas", icon:"📋", tag:"education", risk:"baja", min:2, max:8, desc:"Nadie garantiza rendimientos. Nadie."},
    {label:"Lo denunciás y avisás en el grupo", icon:"📣", tag:"philanthropy", risk:"baja", min:-8, max:-2, desc:"No ganás plata, pero dormís tranquilo."}]},
  {icon:"🚀", eyebrow:"La promesa", text:"Un conocido te jura que tiene un sistema que no falla nunca.",
   detail:"No te explica cómo funciona, pero te muestra el auto que se compró. Dice que entrás hoy o nunca.",
   options:[
    {label:"Le das todo lo que tenés a mano", icon:"🚀", tag:"aggressive", risk:"alta", min:-100, max:112, desc:"El auto era muy convincente."},
    {label:"Le das una parte chica, para ver", icon:"🔍", tag:"moderate", risk:"media", min:-32, max:39, desc:"Lo mínimo para no quedarte con la duda."},
    {label:"Le pedís que te muestre los números", icon:"🧮", tag:"education", risk:"baja", min:2, max:7, desc:"Nunca aparecieron los números."},
    {label:"No, gracias", icon:"🙅", tag:"conservative", risk:"baja", min:2, max:5, desc:"Si no lo entendés, no entres."}]},
  {icon:"🅿️", eyebrow:"Cochera", text:"Se vende una cochera en un edificio con mucho movimiento.",
   detail:"Es la entrada más barata al ladrillo. Renta poco, pero no falla nunca y siempre se vende.",
   options:[
    {label:"Comprás la cochera y la alquilás", icon:"🅿️", tag:"realestate", risk:"baja", min:3, max:8, desc:"Renta chiquita, todos los meses."},
    {label:"Comprás tres en pozo, a estrenar", icon:"🏗️", tag:"realestate", risk:"media", min:-28, max:35, desc:"Más upside, y el riesgo de la obra."},
    {label:"Preferís algo más líquido", icon:"💧", tag:"moderate", risk:"media", min:-30, max:37, desc:"Que puedas vender el martes."}]},
  {icon:"🌾", eyebrow:"Loteo", text:"Se lotea un barrio nuevo a 40 minutos de la ciudad.",
   detail:"Hoy es un campo con estacas. En diez años puede ser un barrio, o seguir siendo un campo con estacas.",
   options:[
    {label:"Comprás dos lotes y esperás", icon:"🌾", tag:"realestate", risk:"alta", min:-75, max:83, desc:"Plata dormida por años, o el negocio de tu vida."},
    {label:"Comprás uno solo", icon:"📐", tag:"realestate", risk:"media", min:-30, max:37, desc:"Una ficha en el tablero, nada más."},
    {label:"Esperás a ver si se puebla", icon:"👀", tag:"conservative", risk:"baja", min:2, max:5, desc:"Que abran primero el supermercado."}]},
  {icon:"🏪", eyebrow:"Local propio", text:"Se libera un local en una esquina que conocés bien.",
   detail:"Siempre dijiste que ahí funcionaría cualquier cosa. Ahora te toca demostrarlo.",
   options:[
    {label:"Abrís tu propio local", icon:"🏪", tag:"business", risk:"alta", min:-80, max:88, desc:"Tu nombre en la persiana."},
    {label:"Lo alquilás y lo subalquilás", icon:"🔑", tag:"realestate", risk:"media", min:-25, max:32, desc:"Negocio de intermediario, sin cocinar."},
    {label:"Lo dejás pasar", icon:"🚶", tag:"conservative", risk:"baja", min:2, max:5, desc:"No todo lo que te gusta es negocio."}]},
  {icon:"📦", eyebrow:"Comercio digital", text:"Podés armar una tienda online con stock propio.",
   detail:"Márgenes buenos si vendés. Un depósito lleno de cajas si no.",
   options:[
    {label:"Comprás stock fuerte y vas a fondo", icon:"📦", tag:"business", risk:"alta", min:-85, max:93, desc:"Todo el capital en mercadería."},
    {label:"Vendés por encargo, sin stock", icon:"📮", tag:"business", risk:"media", min:-22, max:29, desc:"Margen menor, riesgo casi nulo."},
    {label:"Preferís no meterte en logística", icon:"🙅", tag:"conservative", risk:"baja", min:2, max:5, desc:"Ya sabés cómo termina eso."}]},
  {icon:"💳", eyebrow:"Tarjeta", text:"Se te acumuló saldo en la tarjeta y los intereses corren.",
   detail:"Esta deuda no espera. Cada mes que pasa te sale más cara.",
   options:[
    {label:"Refinanciás y seguís invirtiendo igual", icon:"💳", tag:"debt", risk:"alta", min:-90, max:98, desc:"Apostás a rendir más que la tasa."},
    {label:"Pagás la mitad y refinanciás el resto", icon:"⚖️", tag:"moderate", risk:"media", min:-25, max:32, desc:"Cortás lo peor, no todo."},
    {label:"La cancelás toda de una", icon:"✅", tag:"conservative", risk:"baja", min:2, max:6, desc:"Duele hoy, dormís mejor mañana."}]},
  {icon:"🏘️", eyebrow:"Hipoteca", text:"Reabren los créditos hipotecarios ajustados por inflación.",
   detail:"Te permite comprar mucho más de lo que podrías al contado. La cuota se ajusta todos los meses.",
   options:[
    {label:"Tomás la hipoteca más grande que te dan", icon:"🏘️", tag:"debt", risk:"alta", min:-88, max:96, desc:"Comprás grande y rezás por los índices."},
    {label:"Tomás una hipoteca conservadora", icon:"🏠", tag:"realestate", risk:"media", min:-24, max:31, desc:"Cuota que aguantás sin transpirar."},
    {label:"Seguís alquilando y ahorrando", icon:"🔑", tag:"conservative", risk:"baja", min:3, max:7, desc:"Sin deuda atada a un índice."}]},
  {icon:"🥂", eyebrow:"Cámara del sector", text:"Te invitan a integrar la comisión directiva de la cámara del rubro.",
   detail:"Es tiempo que no cobrás, pero te sienta en la mesa donde se enteran las cosas primero.",
   options:[
    {label:"Aceptás y te metés de lleno", icon:"🥂", tag:"networking", risk:"media", min:-20, max:27, desc:"Menos horas tuyas, más puertas abiertas."},
    {label:"Vas a los eventos, sin cargo formal", icon:"🎟️", tag:"networking", risk:"baja", min:2, max:7, desc:"Estás, pero sin firmar nada."},
    {label:"Preferís no perder tiempo", icon:"⌛", tag:"conservative", risk:"baja", min:2, max:5, desc:"Tu agenda ya está llena."}]},
  {icon:"🎙️", eyebrow:"Prensa", text:"Un podcast grande de finanzas te invita a contar tu historia.",
   detail:"Exponerte te trae oportunidades y también gente mirándote con lupa.",
   options:[
    {label:"Vas y contás todo tu método", icon:"🎙️", tag:"networking", risk:"media", min:-22, max:29, desc:"Te vuelve una cara conocida."},
    {label:"Vas, pero medido y sin números", icon:"🤐", tag:"networking", risk:"baja", min:2, max:7, desc:"Perfil alto, exposición baja."},
    {label:"No das entrevistas", icon:"🚫", tag:"conservative", risk:"baja", min:1, max:4, desc:"El que no aparece no se equivoca."}]},
  {icon:"🎒", eyebrow:"Posgrado", text:"Entrás a un posgrado internacional, pero hay que pagarlo en dólares.",
   detail:"Dos años sin mirar el mercado, con un título que abre puertas que hoy están cerradas.",
   options:[
    {label:"Te anotás y lo pagás entero", icon:"🎒", tag:"education", risk:"media", min:-25, max:32, desc:"Plata y tiempo, apostados a vos."},
    {label:"Hacés solo la certificación corta", icon:"📄", tag:"education", risk:"baja", min:2, max:8, desc:"Menos plata, algo del sello."},
    {label:"Aprendés solo, gratis", icon:"💻", tag:"conservative", risk:"baja", min:2, max:5, desc:"Todo está en internet, dicen."}]},
  {icon:"🍲", eyebrow:"El barrio", text:"El comedor del barrio donde creciste está por cerrar.",
   detail:"Nadie te va a devolver esta plata. Algunas cosas no se miden en rendimiento.",
   options:[
    {label:"Te hacés cargo de sostenerlo un año", icon:"🍲", tag:"philanthropy", risk:"baja", min:-26, max:-14, desc:"Plata que sale y no vuelve."},
    {label:"Donás una vez y difundís", icon:"📣", tag:"philanthropy", risk:"baja", min:-12, max:-4, desc:"Ayudás y convocás a otros."},
    {label:"No podés hacerte cargo ahora", icon:"🤷", tag:"conservative", risk:"baja", min:0, max:3, desc:"Te queda la espina."}]},
  {icon:"✈️", eyebrow:"El viaje", text:"El viaje que venís postergando desde los veinte años.",
   detail:"El capital compuesto no perdona los años que le saques. Tu cabeza tampoco perdona los viajes que no hagas.",
   options:[
    {label:"Te vas dos meses, sin mirar el precio", icon:"✈️", tag:"consumption", risk:"baja", spend:true, desc:"Volvés distinto. Con menos plata."},
    {label:"Vas una semana, medido", icon:"🧳", tag:"consumption", risk:"baja", min:-9, max:-3, desc:"Un gustito, sin desarmar nada."},
    {label:"Lo postergás un año más", icon:"📅", tag:"conservative", risk:"baja", min:2, max:6, desc:"Otra vez el año que viene."}]},
  {icon:"🚙", eyebrow:"El 0km", text:"Podés cambiar el auto por uno nuevo, de los que te gustan.",
   detail:"Un auto nuevo es la inversión más mala que existe, y la que más se ve.",
   options:[
    {label:"Te comprás el que querés", icon:"🚙", tag:"consumption", risk:"baja", spend:true, desc:"Se deprecia saliendo de la agencia."},
    {label:"Comprás uno usado y sensato", icon:"🚗", tag:"moderate", risk:"baja", min:-10, max:-2, desc:"Te lleva igual a los mismos lugares."},
    {label:"Arreglás el que tenés", icon:"🔧", tag:"conservative", risk:"baja", min:2, max:6, desc:"Anda, y eso alcanza."}]},
  {icon:"🌱", eyebrow:"Energías renovables", text:"Te ofrecen invertir en un proyecto de energías renovables.",
   detail:"El sector crece fuerte, aunque los proyectos más nuevos son los más inciertos.",
   options:[
    {label:"Invertís en una minera de litio nueva", icon:"🔋", tag:"aggressive", risk:"alta", min:-95, max:115, desc:"Nadie sabe todavía si explota bien o mal."},
    {label:"Comprás un bono verde ya establecido", icon:"🌱", tag:"moderate", risk:"media", min:-25, max:30, desc:"Sustentable y algo más calmo."},
    {label:"Preferís no diversificar para ese lado", icon:"🙅", tag:"conservative", risk:"baja", min:2, max:5, desc:"Seguís con lo conocido."}]}
];

export const EVENTS_AUTO: readonly AutoEvent[] = [
  {text:"Corralito", icon:"🏦", pct:-8, calma:-10},
  {text:"Herencia inesperada", icon:"🎉", fixedAdd:900000, calma:5},
  {text:"El dólar blue pega un salto", icon:"💵", pct:-11},
  {text:"El blue se pega la vuelta y baja", icon:"💵", pct:9},
  {text:"Nuevo cepo cambiario", icon:"🔒", pct:-8, calma:-6},
  {text:"Blanqueo de capitales", icon:"📜", pct:10},
  {text:"La inflación mensual sorprende a la baja", icon:"🎉", pct:9, calma:5},
  {text:"Te devuelven Bienes Personales que no esperabas", icon:"🧾", fixedAdd:450000},
  {text:"Multa impositiva inesperada", icon:"🧾", pct:-5, calma:-4},
  {text:"La Fed las baja de sorpresa", icon:"🏛️", pct:11},
  {text:"Nuevo máximo histórico del Bitcoin", icon:"₿", pct:16},
  {text:"Guerra comercial entre potencias", icon:"🌐", pct:-11},
  {text:"Boom de la inteligencia artificial en la bolsa", icon:"🤖", pct:14},
  {text:"Rally alcista en los mercados globales", icon:"🐂", pct:13},
  {text:"Paro general y no se opera en toda la semana", icon:"✊", pct:-6, calma:-4},
  {text:"Se atrasa el pago de tu plazo fijo por feriado puente", icon:"📅", pct:-3},
  {text:"Cosecha récord y entran dólares al país", icon:"🌾", pct:13, calma:4},
  {text:"Sequía histórica: se cae la liquidación del campo", icon:"☀️", pct:-11, calma:-5},
  {text:"El riesgo país baja fuerte y los bonos vuelan", icon:"📊", pct:17, calma:5},
  {text:"El riesgo país se dispara", icon:"🚨", pct:-12, calma:-7},
  {text:"Cambio de ministro de Economía en pleno lunes", icon:"💼", pct:-7, calma:-6},
  {text:"Cierran el cepo y el mercado festeja", icon:"🔓", pct:16, calma:6},
  {text:"Retenciones nuevas a tu sector", icon:"📑", pct:-8, calma:-4},
  {text:"Te llega la factura de luz con aumento de tarifas", icon:"🔌", pct:-3, calma:-4},
  {text:"Vuelve el Impuesto al Cheque sobre tus movimientos", icon:"🏧", pct:-4},
  {text:"Te toca la lotería de un sorteo del club", icon:"🎟️", fixedAdd:320000, calma:6},
  {text:"Aparece un plan de cuotas sin interés y estirás la plata", icon:"💳", pct:7, calma:4},
  {text:"Rulo de dólar MEP bien hecho", icon:"🔁", pct:12},
  {text:"Te frenan una transferencia por control cambiario", icon:"🛑", pct:-5, calma:-6},
  {text:"Sube el ladrillo medido en dólares", icon:"🧱", pct:11},
  {text:"Se cae un banco digital y quedás sin acceso unos días", icon:"📵", pct:-7, calma:-7},
  {text:"Elecciones: el mercado se pone en modo espera", icon:"🗳️", pct:-5, calma:-5},
  {text:"Pasan las elecciones y se acomoda todo", icon:"🎊", pct:14, calma:6},
  {text:"Mundial: no se habla de otra cosa y nadie opera", icon:"⚽", pct:-3, calma:8},
  {text:"Argentina gana y el humor del país mejora", icon:"🏆", pct:8, calma:10},

  // — guiños históricos, Argentina —
  {text:"Te aumentan las tarifas, el transporte y el dólar el mismo día", icon:"🧨", pct:-15, calma:-6},
  {text:"Te canjean los depósitos por bonos a diez años. No preguntaron.", icon:"📄", pct:-16, calma:-9},
  {text:"La crisis mexicana te salpica los bancos", icon:"🍹", pct:-11, calma:-5},
  {text:"Devalúa Brasil y tu industria no puede competir", icon:"🍸", pct:-9},
  {text:"Los precios cambian dos veces por día y nadie sabe cuánto vale nada", icon:"🧾", pct:-18, calma:-10},
  {text:"Sale una moneda nueva y hay que aprender los ceros de cero", icon:"💵", pct:-6, calma:-4},
  {text:"Un peso, un dólar. Por un rato todo parece previsible.", icon:"🤝", pct:10, calma:8},
  {text:"Se cae la paridad uno a uno y el dólar se va al triple", icon:"💥", pct:-21, calma:-10},
  {text:"Ahora ni con amparo judicial sacás la plata del banco", icon:"🔐", pct:-13, calma:-10},
  {text:"El lunes después de las primarias, corrida histórica", icon:"📉", pct:-16, calma:-8},
  {text:"Megacanje: patean todos los vencimientos para adelante", icon:"🔄", pct:-7},
  {text:"El país deja de pagar y los bonos pasan a valer monedas", icon:"🏳️", pct:-20, calma:-9},
  {text:"Canje con quita: los acreedores cobran la mitad y firman igual", icon:"✂️", pct:12},
  {text:"El país le paga todo al Fondo de una sola vez", icon:"🧳", pct:11, calma:6},
  {text:"Fallo a favor de los fondos buitre: default técnico", icon:"🦅", pct:-14, calma:-6},
  {text:"Arreglan con los holdouts y el país vuelve a los mercados", icon:"🚪", pct:16, calma:5},
  {text:"Te reperfilan el vencimiento. Es default, pero con mejor nombre.", icon:"📐", pct:-12, calma:-7},
  {text:"La tablita cambiaria promete previsibilidad. Duró poco.", icon:"🪜", pct:-10, calma:-5},
  {text:"Aparece el dólar solidario, con impuesto adentro", icon:"🎫", pct:-7},
  {text:"Ya hay dólar turista, MEP, blue, ahorro y dos más. Nadie sabe cuál mirar.", icon:"🎰", pct:-5, calma:-7},
  {text:"Tipo de cambio especial para el campo y entran divisas", icon:"🌱", pct:12},
  {text:"Vaca Muerta entra en escena y el país sueña con energía", icon:"🛢️", pct:15, calma:5},
  {text:"El litio del norte se vuelve el oro blanco de las baterías", icon:"🔋", pct:13},
  {text:"Récord histórico de reservas en el Banco Central", icon:"🏦", pct:11, calma:5},
  {text:"Boom sojero: la exportación en precios récord", icon:"🐂", pct:16, calma:5},
  {text:"Recuperación en V: el país rebota más rápido de lo que nadie esperaba", icon:"📈", pct:17, calma:6},
  {text:"Superávit gemelos: fiscal y comercial al mismo tiempo", icon:"👯", pct:12, calma:6},
  {text:"Te reclasifican como mercado emergente y entran fondos de afuera", icon:"🎖️", pct:14, calma:4},
  {text:"Te bajan de emergente a frontera y los fondos se van", icon:"🪫", pct:-12, calma:-6},
  {text:"Estatizan los fondos de pensión privados", icon:"🏛️", pct:-11, calma:-6},
  {text:"Conflicto con el campo: cuatro meses sin liquidar nada", icon:"🚜", pct:-9, calma:-5},
  {text:"Ley de abastecimiento: te controlan precios y stock", icon:"📋", pct:-6, calma:-4},
  {text:"Primer pánico financiero del país. Y van.", icon:"🕰️", pct:-11, calma:-5},

  // — guiños históricos, mundo —
  {text:"Se derrumba Wall Street y arranca la Gran Depresión", icon:"🎩", pct:-22, calma:-10},
  {text:"Lunes Negro: los mercados del mundo caen todos juntos en un día", icon:"🌑", pct:-16, calma:-8},
  {text:"Los tigres asiáticos se desinflan de golpe", icon:"🐯", pct:-11},
  {text:"Estalla la burbuja de las puntocom", icon:"💻", pct:-16, calma:-7},
  {text:"Crisis de las hipotecas basura en Estados Unidos", icon:"🏚️", pct:-15, calma:-7},
  {text:"Crisis de deuda en Europa, con epicentro en Grecia", icon:"🇪🇺", pct:-12, calma:-6},
  {text:"Estados Unidos pierde la nota AAA por primera vez en la historia", icon:"🅰️", pct:-10, calma:-5},
  {text:"Pandemia: cierra el mundo entero el mismo mes", icon:"😷", pct:-20, calma:-9},
  {text:"Se cae una gran plataforma de cripto y la plata se evapora", icon:"🧊", pct:-16, calma:-8},
  {text:"Quiebra un banco de tecnología en Silicon Valley", icon:"🏚️", pct:-13, calma:-6},
  {text:"Un banco suizo histórico termina absorbido por su competidor", icon:"🇨🇭", pct:-11, calma:-5},
  {text:"Shock petrolero: cortan el suministro y se para todo", icon:"⛽", pct:-13, calma:-6},
  {text:"El petróleo cotiza en negativo: te pagan por llevártelo", icon:"🛢️", pct:-7, calma:-8},
  {text:"Se rompe la convertibilidad del oro con el dólar", icon:"🥇", pct:-8, calma:-5},
  {text:"Miércoles Negro: una moneda europea se cae a pedazos", icon:"💷", pct:-10},
  {text:"La Fed avisa que va a cerrar la canilla y los mercados entran en pánico", icon:"😱", pct:-11, calma:-6},
  {text:"Devaluación sorpresiva del yuan", icon:"🇨🇳", pct:-8},
  {text:"El Reino Unido vota irse de la Unión Europea", icon:"🇬🇧", pct:-10, calma:-5},
  {text:"Un foro de internet hace volar la acción de una cadena de videojuegos", icon:"🎮", pct:18, calma:6},
  {text:"Boom de arte digital: se venden imágenes a precios delirantes", icon:"🖼️", pct:14},
  {text:"Plan de estabilización: la inflación frena de golpe", icon:"🧯", pct:13, calma:7},
  {text:"Apertura a capitales extranjeros y entra inversión de afuera", icon:"🛬", pct:11, calma:4},
  {text:"Congelan precios y salarios: por unos meses no sube nada", icon:"🧊", pct:6, calma:5},
  {text:"Acuerdan un sistema monetario nuevo y baja la incertidumbre global", icon:"📜", pct:9, calma:5},
  {text:"Los rescates frenan el contagio en Europa", icon:"🛟", pct:8, calma:4},
  {text:"Reabren la canilla del petróleo y baja el combustible", icon:"⛽", pct:9},
  {text:"Ordenan la política monetaria y el peso deja de temblar", icon:"🏛️", pct:7, calma:5},
  {text:"Se despejan los vencimientos del año y respira el mercado", icon:"🌬️", pct:10, calma:5}
];

export const EVENTS_COND: readonly AutoEvent[] = [
  {text:"Explota tu cripto favorita", icon:"🚀", pct:45, cond:"aggressive"},
  {text:"Se destapa una estafa piramidal", icon:"💸", pct:-35, cond:"aggressive", calma:-10},
  {text:"Boom inmobiliario y tu propiedad vuela", icon:"🏠", pct:22, cond:"realestate"},
  {text:"Se cae una venta que tenías casi cerrada", icon:"📉", pct:-20, cond:"business", calma:-6},
  {text:"Te llaman de un fondo por tu reputación", icon:"🤝", pct:18, cond:"networking"},
  {text:"Los intereses de tu deuda te comen el mes", icon:"💳", pct:-22, cond:"debt", calma:-8},
  {text:"Un ex alumno te recomienda y cobrás honorarios", icon:"🎓", pct:14, cond:"education"},
  {text:"Tu plazo fijo te salva del derrumbe general", icon:"🛟", pct:11, cond:"conservative", calma:6},
  {text:"Por prudente te quedás afuera del mejor rally del año", icon:"🐌", pct:-9, cond:"conservative"},
  {text:"Tu cartera diversificada aguanta el cimbronazo", icon:"⚖️", pct:12, cond:"moderate", calma:4},
  {text:"Rebalanceaste tarde y te comiste la baja", icon:"📉", pct:-14, cond:"moderate", calma:-4},
  {text:"Tu nombre en la donación te abre un contrato grande", icon:"🤝", pct:20, cond:"philanthropy", calma:5},
  {text:"Se filtra cuánto gastás y te cierran una puerta", icon:"👀", pct:-16, cond:"consumption", calma:-5},
  {text:"Tu inquilino no paga y el contrato está por índice", icon:"🔑", pct:-17, cond:"realestate", calma:-6},
  {text:"Te habilitan el alquiler en dólares y renegociás", icon:"🏘️", pct:19, cond:"realestate", calma:4},
  {text:"Te sale un contrato exportando y cobrás en dólares", icon:"📦", pct:24, cond:"business", calma:4},
  {text:"Se te duplica la cuota UVA de un mes al otro", icon:"📈", pct:-24, cond:"debt", calma:-9},
  {text:"Refinanciás la deuda con tasa vieja y ganás", icon:"🤏", pct:15, cond:"debt", calma:5},
  {text:"Te invitan a un asado donde se arma un negocio", icon:"🥩", pct:16, cond:"networking", calma:6},
  {text:"Das una charla en una universidad y te llueven consultas", icon:"🎓", pct:13, cond:"education", calma:4},
  {text:"Tu plazo fijo UVA le gana a la inflación del trimestre", icon:"🧮", pct:13, cond:"conservative", calma:5},
  {text:"Te bancás el ahorro en pesos y te lo come la inflación", icon:"🕳️", pct:-12, cond:"conservative", calma:-4},
  {text:"Pusiste plata en el club del barrio y te lo devuelven en contactos", icon:"⚽", pct:15, cond:"philanthropy", calma:6},
  {text:"Te fotografían de vacaciones y se habla más de eso que de tu laburo", icon:"📸", pct:-13, cond:"consumption", calma:-4}
];

export const EVENTS_CHOICE: readonly ChoiceEvent[] = [
  {icon:"🕵️", eyebrow:"Info filtrada", text:"Un contacto te pasa un dato sobre una empresa antes de que sea público.",
   detail:"Operar con información privilegiada no es del todo legal, pero la tentación está ahí.",
   options:[
    {label:"Operás con el dato", icon:"🤫", desc:"Si sale bien, nadie pregunta.", min:-70, max:130, rep:-6, calma:-8},
    {label:"Preferís no meterte en líos", icon:"🙅", desc:"Dormís tranquilo esta noche.", min:0, max:0, rep:4, calma:5}]},
  {icon:"🐦", eyebrow:"Redes", text:"Te cruzan en las redes y te tratan de vende humo.",
   detail:"Todo el mundo está mirando cómo reaccionás.",
   options:[
    {label:"Salís a responder fuerte", icon:"🔥", desc:"Puede jugarte a favor, o en contra.", min:-40, max:60, rep:-4, calma:-6},
    {label:"Ignorás y seguís de largo", icon:"🙉", desc:"El ruido pasa solo.", min:-5, max:5, rep:3, calma:3}]},
  {icon:"📢", eyebrow:"Balance", text:"Una empresa que seguís presenta su balance trimestral.",
   detail:"El mercado suele reaccionar fuerte, para cualquiera de los dos lados.",
   options:[
    {label:"Comprás antes del anuncio", icon:"🎯", desc:"Apostás a la sorpresa positiva.", min:-60, max:90, calma:-6},
    {label:"Esperás a ver los números", icon:"⏳", desc:"Menos sorpresa, menos jugada.", min:0, max:5, calma:2}]},
  {icon:"🃏", eyebrow:"La timba", text:"En una previa te arman una mesa de truco por plata.",
   detail:"No es una inversión, pero la billetera no distingue de dónde viene la ganancia.",
   options:[
    {label:"Te metés a jugar", icon:"🎲", desc:"Puede ser tu noche, o no.", min:-50, max:50, calma:4},
    {label:"Mirás desde afuera", icon:"👀", desc:"Guardás la plata para otra cosa.", min:0, max:0}]},
  {icon:"⚡", eyebrow:"Atajo turbio", text:"Te ofrecen un préstamo informal, rápido y sin preguntas.",
   detail:"Es plata fácil hoy, pero si algo sale mal no hay banco que te banque.",
   options:[
    {label:"Aceptás el atajo", icon:"⚡", desc:"Todo más rápido, todo más frágil.", min:-90, max:120, rep:-5, calma:-12},
    {label:"Preferís el camino largo", icon:"🐢", desc:"Menos vértigo, menos drama.", min:0, max:0, calma:6}]},
  {icon:"📱", eyebrow:"Señales pagas", text:"Un influencer vende 'señales' de trading por suscripción.",
   detail:"Promete rendimientos que ningún banco te podría ofrecer.",
   options:[
    {label:"Te suscribís y seguís sus señales", icon:"📈", desc:"A veces acierta, a veces no.", min:-55, max:65, calma:-4},
    {label:"Pasás de largo", icon:"🚫", desc:"Ya escuchaste esta antes.", min:0, max:0, rep:2}]}
];

export const TITLES: Record<TitleKey, Title> = {
  imperio:{title:"El Imperio", icon:"👑", blurb:"Ya no manejás plata: manejás un imperio. Nadie vio venir esto."},
  quiebra:{title:"Fundido", icon:"🏚️", blurb:"Te quedaste sin nada antes del final. El mercado no perdona."},
  insomne:{title:"El Magnate Insomne", icon:"🥃", blurb:"Ganaste una fortuna y perdiste el sueño en el camino."},
  generoso:{title:"El Generoso", icon:"❤️", blurb:"Diste más de lo que guardaste, y no te arrepentís."},
  estudioso:{title:"El Estudioso", icon:"📚", blurb:"Apostaste a vos mismo antes que al mercado."},
  temerario:{title:"El Que No le Teme a Nada", icon:"🎲", blurb:"Cada ronda, la apuesta más grande de la mesa."},
  disfruton:{title:"El Que Vivió el Momento", icon:"🍸", blurb:"Menos ceros en la cuenta, más historias para contar."},
  referente:{title:"El Referente", icon:"🎤", blurb:"Tu nombre abre puertas que la plata sola no abre."},
  magnate:{title:"El Magnate", icon:"💰", blurb:"Multiplicaste tu capital contra todos los pronósticos."},
  independencia:{title:"Independencia Financiera", icon:"💼", blurb:"Construiste un colchón que te banca solo."},
  constructor:{title:"El Constructor Silencioso", icon:"🐢", blurb:"Paso a paso, sin sobresaltos, hasta arriba."},
  zafando:{title:"Raspando pero Zafando", icon:"😅", blurb:"Sobreviviste, que ya es bastante."},
  servido:{title:"El Que Tenía Todo Servido", icon:"🥄", blurb:"Naciste con la mesa puesta y te la comiste toda. Pasa."},
  ladrillo:{title:"El Rey del Ladrillo", icon:"🧱", blurb:"Todo tu patrimonio tiene paredes, techo y escritura."},
  equilibrista:{title:"El Equilibrista", icon:"🎪", blurb:"Viviste apalancado doce rondas y llegaste entero. Casi."},
  emprendedor:{title:"El Que Se La Jugó por lo Suyo", icon:"🏗️", blurb:"No invertiste en el mercado: construiste algo."},
  deberes:{title:"El Que Hizo los Deberes", icon:"📋", blurb:"Sin épica y sin desastre. Cumpliste, que no es poco."},
  pulso:{title:"El Pulso Firme", icon:"🫀", blurb:"Arriesgaste como el que más, y nunca te tembló la mano."},
  perdido:{title:"El Que Perdió Casi Todo", icon:"🕳️", blurb:"Quedaron migas de lo que pudo ser una fortuna."}
};

export const RAREZA: Record<TitleKey, number> = {
  servido:0.1, insomne:0.3, imperio:0.7, zafando:0.9, perdido:0.9, quiebra:1.3,
  generoso:2.8, pulso:3.2, equilibrista:3.9, disfruton:4.4, ladrillo:6, magnate:7.1,
  emprendedor:7.4, estudioso:7.7, deberes:8.3, temerario:9.4, constructor:9.4,
  referente:13, independencia:13.3
};

export const TAG_PESO: Record<Tag, number> = {conservative:10.8, moderate:7.5, aggressive:4.2, business:2.4, realestate:2.4,
  debt:1.8, networking:1.2, consumption:1.2, education:0.9, philanthropy:0.9};

export const TAG_FINAL: Partial<Record<Tag, TitleKey>> = {realestate:'ladrillo', debt:'equilibrista', business:'emprendedor',
  networking:'referente', conservative:'constructor', aggressive:'pulso',
  education:'estudioso', philanthropy:'generoso', consumption:'disfruton'};

export const FIRMA_MIN = 2, FIRMA_SCORE = 0.7;

export const ORDEN_COL: readonly TitleKey[] = ['servido','insomne','imperio','zafando','perdido','quiebra','generoso','pulso',
  'equilibrista','disfruton','ladrillo','magnate','emprendedor','estudioso','deberes','temerario',
  'constructor','referente','independencia'];
