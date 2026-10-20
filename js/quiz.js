// =============================================================
// Datos del quiz (30 preguntas).
// Generado automáticamente por backend/generate_quiz.py
// a partir de los PDF ingestados en la base de datos vectorial.
// =============================================================

const quizData = [
    {
        pregunta: "¿Qué modelo de distribución territorial del Estado establece la Constitución Española para España?",
        opciones: [ "A) Una confederación de nacionalidades y regiones con soberanía compartida", "B) Un Estado centralizado y unitario que no reconoce autonomías territoriales", "C) Un Estado federal con estados miembros que poseen soberanía propia", "D) Un Estado de las autonomías, que no es ni centralizado unitario ni federal" ],
        correcta: 3,
        explicacion: "El texto indica expresamente que España se configura como un Estado de las autonomías, es decir, no se trata ni de un Estado centralizado y unitario, ni de un Estado federal, sino de una fórmula que compagina la soberanía nacional con el derecho de autonomía de las nacionalidades y regiones."
    },
    {
        pregunta: "¿Qué órgano propone y qué órgano declara el estado de sitio, y con qué mayoría se aprueba?",
        opciones: [ "A) Lo propone el Rey y lo declara el Congreso de los Diputados por mayoría simple", "B) Lo propone el Gobierno y lo declara el Senado por mayoría absoluta", "C) Lo propone el Congreso de los Diputados y lo declara el Gobierno por mayoría absoluta", "D) Lo propone el Gobierno y lo declara el Congreso de los Diputados por mayoría absoluta" ],
        correcta: 3,
        explicacion: "El texto señala que el estado de sitio se declarará por mayoría absoluta del Congreso de los Diputados, a propuesta exclusiva del Gobierno. Por tanto, la iniciativa corresponde al Gobierno y la declaración al Congreso de los Diputados con mayoría absoluta."
    },
    {
        pregunta: "¿Cuál es el orden correcto de las fases de tramitación en el procedimiento legislativo ordinario?",
        opciones: [ "A) Presentación de enmiendas, publicación en el BOCG, votación en comisión, aprobación en Pleno, discusión del dictamen, paso al Senado", "B) Publicación en el BOCG, presentación de enmiendas, votación en comisión, discusión del dictamen en Pleno, aprobación en Pleno, paso al Senado", "C) Publicación en el BOCG, votación en comisión, presentación de enmiendas, discusión del dictamen, aprobación en Pleno, paso al Senado", "D) Publicación en el BOCG, presentación de enmiendas, discusión del dictamen en Pleno, votación en comisión, aprobación en Pleno, paso al Senado" ],
        correcta: 1,
        explicacion: "El texto establece el siguiente orden: 2.1 Publicación en el Boletín Oficial de las Cortes Generales, 2.2 Presentación de enmiendas, 2.3 Votación de enmiendas en comisión, 2.4 Discusión del dictamen de la comisión en Pleno del Congreso, 2.5 Aprobación en Pleno del Congreso, y 2.6 Paso al Senado para estudio y votación."
    },
    {
        pregunta: "¿Qué artículo de la Constitución Española establece que el Tribunal Constitucional tiene jurisdicción en todo el territorio español?",
        opciones: [ "A) El artículo 165 de la CE", "B) El artículo 159 de la CE", "C) El artículo 161 de la CE", "D) El artículo 167 de la CE" ],
        correcta: 2,
        explicacion: "El texto indica expresamente que «El Tribunal Constitucional tiene jurisdicción en todo el territorio español (artículo 161 de la CE)». Los artículos 159, 165 y 167 no se mencionan en el contexto como base de dicha jurisdicción territorial."
    },
    {
        pregunta: "¿A qué órgano corresponde exclusivamente la decisión sobre la inculpación, prisión, procesamiento y juicio del Defensor del Pueblo mientras permanezca en el ejercicio de sus funciones?",
        opciones: [ "A) A la Sala de lo Penal del Tribunal Supremo", "B) A la Sala de lo Contencioso-Administrativo del Tribunal Supremo", "C) Al Pleno del Tribunal Constitucional", "D) Al Congreso de los Diputados" ],
        correcta: 0,
        explicacion: "El texto establece de forma clara que, en los demás casos y mientras permanezcan en el ejercicio de sus funciones, «correspondiendo la decisión sobre su inculpación, prisión, procesamiento y juicio exclusivamente a la Sala de lo Penal del Tribunal Supremo». Ningún otro órgano es mencionado para esa función."
    },
    {
        pregunta: "¿Cuál de las siguientes materias queda excluida de la obligatoriedad de la negociación colectiva conforme al artículo 37.2 del TREBEP?",
        opciones: [ "A) Los criterios generales de Acción Social", "B) Los criterios generales sobre ofertas de empleo público", "C) Las propuestas sobre derechos sindicales y de participación", "D) Las decisiones de las Administraciones Públicas que afecten a sus potestades de organización" ],
        correcta: 3,
        explicacion: "El texto señala que las materias excluidas de la obligatoriedad de la negociación, según el artículo 37.2 TREBEP, son «las decisiones de las Administraciones Públicas que afecten a sus potestades de organización». Las demás opciones (ofertas de empleo público, derechos sindicales y Acción Social) aparecen en el listado de materias sujetas a negociación, no excluidas de ella."
    },
    {
        pregunta: "¿En qué supuesto se amplía el permiso en dos semanas más para ambos progenitores?",
        opciones: [ "A) En el supuesto de guarda con fines de adopción", "B) En el supuesto de nacimiento de un segundo hijo o hija", "C) En el supuesto de nacimiento, adopción o acogimiento múltiple", "D) En el supuesto de discapacidad del hijo o hija" ],
        correcta: 3,
        explicacion: "El texto establece expresamente que el permiso se ampliará para ambos progenitores en dos semanas más en el supuesto de discapacidad del hijo o hija. Los supuestos de nacimiento, adopción, guarda con fines de adopción o acogimiento múltiple generan una ampliación de una semana por cada hijo a partir del segundo, no de dos semanas."
    },
    {
        pregunta: "Ante una instrucción o orden profesional de un superior que constituya una infracción manifiesta del ordenamiento jurídico, el empleado público deberá:",
        opciones: [ "A) Ponerla inmediatamente en conocimiento de los órganos de inspección procedentes", "B) Cumplirla y dejar constancia de la irregularidad en su informe de servicio", "C) Ponerla inmediatamente en conocimiento de los órganos judiciales competentes", "D) Negarse a cumplirla y comunicarlo a su superior jerárquico inmediato" ],
        correcta: 0,
        explicacion: "El artículo 54 del TREBEP, citado en el contexto, indica que el empleado público obedecerá las instrucciones y órdenes profesionales de los superiores, salvo que constituyan una infracción manifiesta del ordenamiento jurídico, en cuyo caso las pondrá inmediatamente en conocimiento de los órganos de inspección procedentes. No se menciona la comunicación al superior jerárquico ni a los órganos judiciales."
    },
    {
        pregunta: "¿Cuál es la excepción reconocida en el ámbito laboral a la incompatibilidad entre el desempeño de un puesto de trabajo y la percepción de pensión de jubilación?",
        opciones: [ "A) La pensión de jubilación parcial es compatible con un puesto de trabajo a tiempo completo", "B) La pensión de jubilación completa es compatible con un puesto de trabajo a tiempo completo", "C) La pensión de jubilación completa es compatible con un puesto de trabajo a tiempo parcial", "D) La pensión de jubilación parcial es compatible con un puesto de trabajo a tiempo parcial" ],
        correcta: 3,
        explicacion: "El texto señala expresamente que, por excepción, en el ámbito laboral, será compatible la pensión de jubilación parcial con un puesto de trabajo a tiempo parcial. No se reconoce compatibilidad para la pensión de jubilación completa ni para el trabajo a tiempo completo."
    },
    {
        pregunta: "¿Cuál de las siguientes definiciones corresponde al concepto de «delito doloso» en el ámbito de las faltas de los funcionarios?",
        opciones: [ "A) Conducta que lleva a cabo una persona con dolo eventual, encaminada y orientada a la comisión de un acto que la ley tipifica como infracción grave.", "B) Conducta que lleva a cabo una persona con negligencia grave, encaminada y orientada a la omisión de un acto que la ley tipifica como falta administrativa.", "C) Conducta que lleva a cabo una persona con voluntad consciente, encaminada y orientada a la realización de un acto que la ley tipifica como delito.", "D) Conducta que lleva a cabo una persona con voluntad consciente, encaminada y orientada a la omisión de un acto que la ley tipifica como falta muy grave." ],
        correcta: 2,
        explicacion: "El texto define expresamente el delito doloso como la «conducta que lleva a cabo una persona con voluntad consciente, encaminada y orientada a la realización de un acto que la ley tipifica como delito». Las demás opciones sustituyen elementos clave: «negligencia grave» en lugar de «voluntad consciente», «omisión» en lugar de «realización», «dolo eventual» en lugar de «voluntad consciente», o cambian la calificación jurídica de «delito» a «falta administrativa», «infracción grave» o «falta muy grave»."
    },
    {
        pregunta: "En relación con el acceso a información que contenga datos meramente identificativos relacionados con la organización, funcionamiento o actividad pública del órgano, ¿cuál es la excepción que puede impedir la concesión de dicho acceso?",
        opciones: [ "A) Que el órgano competente considere que la divulgación puede generar un perjuicio económico para la Administración Pública.", "B) Que la solicitud de acceso se presente fuera del plazo reglamentario establecido para la tramitación del expediente.", "C) Que en el caso concreto prevalezca la protección de datos personales u otros derechos constitucionalmente protegidos sobre el interés público en la divulgación.", "D) Que la información solicitada haya sido generada con carácter interno y no haya sido publicada en el boletín oficial correspondiente." ],
        correcta: 2,
        explicacion: "El texto establece que, con carácter general, se concederá el acceso a dicha información «salvo que en el caso concreto prevalezca la protección de datos personales u otros derechos constitucionalmente protegidos sobre el interés público en la divulgación que lo impida». Las otras opciones (perjuicio económico, plazo de solicitud, carácter interno no publicado) no aparecen como excepciones en el texto."
    },
    {
        pregunta: "¿A qué Ministerio está adscrito el Consejo de Transparencia y Buen Gobierno?",
        opciones: [ "A) Al Ministerio de Hacienda y Administraciones Públicas.", "B) Al Ministerio de Justicia.", "C) Al Ministerio de Función Pública.", "D) Al Ministerio de la Presidencia." ],
        correcta: 0,
        explicacion: "El artículo 33.1 del texto indica expresamente que el Consejo de Transparencia y Buen Gobierno «estará adscrito al Ministerio de Hacienda y Administraciones Públicas». Las demás opciones mencionan ministerios que, aunque plausibles en el ámbito de la transparencia, no son los que el texto señala como adscripción del Consejo."
    },
    {
        pregunta: "¿En qué fecha se aprobó la Resolución por la Asamblea General que presenta la Agenda 2030 como un plan de acción en favor de las personas, el planeta y la prosperidad?",
        opciones: [ "A) 1 de enero de 2016", "B) 25 de septiembre de 2016", "C) 25 de septiembre de 2015", "D) 9 de diciembre de 2015" ],
        correcta: 2,
        explicacion: "El texto indica expresamente que la Resolución fue aprobada por la Asamblea General el 25 de septiembre de 2015, y en ella se señala que la Agenda es un plan de acción en favor de las personas, el planeta y la prosperidad. La fecha del 1 de enero de 2016 corresponde al inicio de la vigencia de los 17 objetivos, no a la aprobación de la Resolución."
    },
    {
        pregunta: "¿En qué condiciones se prevé la transferencia de tecnologías ecológicamente racionales a los países en desarrollo dentro de los medios de implementación de la Agenda 2030?",
        opciones: [ "A) En condiciones unilaterales impuestas por los países desarrollados", "B) En condiciones exclusivamente comerciales determinadas por el mercado internacional", "C) En condiciones establecidas exclusivamente por el Fondo Monetario Internacional", "D) En condiciones favorables, e incluso en condiciones concesionarias y preferenciales establecidas de mutuo acuerdo" ],
        correcta: 3,
        explicacion: "El texto señala textualmente que los medios incluirán la transferencia a los países en desarrollo de tecnologías ecológicamente racionales en condiciones favorables, e incluso en condiciones concesionarias y preferenciales establecidas de mutuo acuerdo. Las demás opciones contradicen el carácter bilateral y concesionario que el texto atribuye a dicha transferencia."
    },
    {
        pregunta: "¿A qué grupos de países se dirige específicamente el punto 9.a para facilitar el desarrollo de infraestructuras sostenibles y resilientes mediante un mayor apoyo financiero, tecnológico y técnico?",
        opciones: [ "A) Países africanos, países menos adelantados, países en desarrollo costeros y pequeños Estados insulares desarrollados", "B) Países africanos, países industrializados, países en desarrollo costeros y grandes Estados continentales", "C) Países asiáticos, países desarrollados, países en desarrollo sin litoral y grandes Estados insulares", "D) Países africanos, países menos adelantados, países en desarrollo sin litoral y pequeños Estados insulares en desarrollo" ],
        correcta: 3,
        explicacion: "El texto del punto 9.a menciona de forma explícita a los países africanos, los países menos adelantados, los países en desarrollo sin litoral y los pequeños Estados insulares en desarrollo como destinatarios del mayor apoyo financiero, tecnológico y técnico. Las opciones incorrectas sustituyen alguno de estos grupos por categorías no contempladas en el texto, como países industrializados, países costeros o grandes Estados continentales."
    },
    {
        pregunta: "De acuerdo con el artículo 37.2 del TREBEP, queda excluida de la obligatoriedad de la negociación colectiva:",
        opciones: [ "A) Los criterios generales sobre ofertas de empleo público", "B) Los criterios generales de Acción Social", "C) Las decisiones de las Administraciones Públicas que afecten a sus potestades de organización", "D) Las propuestas sobre derechos sindicales y de participación" ],
        correcta: 2,
        explicacion: "El texto indica que las materias excluidas de la obligatoriedad de la negociación, según el artículo 37.2 TREBEP, son «las decisiones de las Administraciones Públicas que afecten a sus potestades de organización». En cambio, los criterios generales sobre ofertas de empleo público, las propuestas sobre derechos sindicales y de participación, y los criterios generales de Acción Social figuran entre las materias que sí están sujetas a negociación colectiva."
    },
    {
        pregunta: "En el supuesto de discapacidad del hijo o hija, el permiso de nacimiento se ampliará para ambos progenitores en:",
        opciones: [ "A) tres semanas más", "B) dos semanas más", "C) una semana más", "D) cuatro semanas más" ],
        correcta: 1,
        explicacion: "El texto señala de forma literal que «este permiso se ampliará para ambos progenitores en dos semanas más en el supuesto de discapacidad del hijo o hija». La ampliación de una semana por progenitor corresponde a un supuesto distinto: el de nacimiento, adopción, guarda con fines de adopción o acogimiento múltiples a partir del segundo hijo."
    },
    {
        pregunta: "¿Quién convoca las reuniones del foro de múltiples interesados sobre ciencia, tecnología e innovación en pro de los Objetivos de Desarrollo Sostenible?",
        opciones: [ "A) El Presidente de la Asamblea General", "B) El Director del equipo de tareas de expertos", "C) El Secretario General de las Naciones Unidas", "D) El Presidente del Consejo Económico y Social" ],
        correcta: 3,
        explicacion: "El documento establece expresamente que las reuniones del foro serán convocadas por el Presidente del Consejo Económico y Social antes de las reuniones del foro político de alto nivel bajo los auspicios del Consejo, o bien en conjunción con otros foros o conferencias. Las demás opciones no aparecen como convocantes en el texto."
    },
    {
        pregunta: "¿Cuál de las siguientes materias queda excluida de la obligatoriedad de la negociación colectiva en el ámbito de la función pública?",
        opciones: [ "A) Los criterios generales de Acción Social", "B) Las propuestas sobre derechos sindicales y de participación", "C) Las decisiones de las Administraciones Públicas que afecten a sus potestades de organización", "D) Los criterios generales sobre ofertas de empleo público" ],
        correcta: 2,
        explicacion: "El artículo 37.2 TREBEP señala como materia excluida de la obligatoriedad de la negociación las decisiones de las Administraciones Públicas que afecten a sus potestades de organización. Por el contrario, los criterios generales de Acción Social, las propuestas sobre derechos sindicales y de participación, y los criterios generales sobre ofertas de empleo público figuran entre las materias que sí están sujetas a negociación obligatoria."
    },
    {
        pregunta: "Cuando las instrucciones u órdenes profesionales de un superior constituyen una infracción manifiesta del ordenamiento jurídico, el empleado público deberá:",
        opciones: [ "A) Ponerlas inmediatamente en conocimiento de los órganos de inspección procedentes", "B) Solicitar por escrito al superior la justificación de la orden antes de decidir su cumplimiento", "C) Cumplirlas y comunicar la situación al comité de empresa en un plazo de 48 horas", "D) Negarse a cumplirlas y presentar una queja ante el Defensor del Pueblo" ],
        correcta: 0,
        explicacion: "El artículo 54 del TREBEP establece que los empleados públicos obedecerán las instrucciones y órdenes profesionales de los superiores, salvo que constituyan una infracción manifiesta del ordenamiento jurídico, en cuyo caso las pondrán inmediatamente en conocimiento de los órganos de inspección procedentes."
    },
    {
        pregunta: "Entre las faltas muy graves del empleado público se incluye la tolerancia de los superiores respecto de la comisión de:",
        opciones: [ "A) Faltas muy graves o graves de sus subordinados", "B) Faltas graves o leves de sus subordinados", "C) Faltas muy graves o leves de sus compañeros", "D) Faltas leves o graves de sus subordinados" ],
        correcta: 0,
        explicacion: "El texto señala como falta muy grave la tolerancia de los superiores respecto de la comisión de faltas muy graves o graves de sus subordinados. Las opciones incorrectas sustituyen 'muy graves' por 'leves' o cambian 'subordinados' por 'compañeros', lo cual no se corresponde con lo establecido."
    },
    {
        pregunta: "¿A qué Ministerio está adscrito el Consejo de Transparencia y Buen Gobierno, creado como organismo público al amparo de la disposición adicional décima de la Ley 6/1997?",
        opciones: [ "A) Al Ministerio de Justicia y Administraciones Públicas", "B) Al Ministerio de Hacienda y Administraciones Públicas", "C) Al Ministerio de la Presidencia y para las Administraciones Públicas", "D) Al Ministerio de Economía y Hacienda" ],
        correcta: 1,
        explicacion: "El artículo 33.1 del texto indica expresamente que el Consejo de Transparencia y Buen Gobierno estará adscrito al Ministerio de Hacienda y Administraciones Públicas, y que se crea como organismo público de los previstos en la disposición adicional décima de la Ley 6/1997, de 14 de abril, de Organización y Funcionamiento de la Administración General del Estado."
    },
    {
        pregunta: "¿Cuántos objetivos de desarrollo sostenible contiene la Agenda 2030 aprobada en la Cumbre del Desarrollo Sostenible de septiembre de 2015?",
        opciones: [ "A) 12 objetivos de desarrollo sostenible de aplicación universal", "B) 15 objetivos de desarrollo sostenible de aplicación universal", "C) 21 objetivos de desarrollo sostenible de aplicación universal", "D) 17 objetivos de desarrollo sostenible de aplicación universal" ],
        correcta: 3,
        explicacion: "El texto señala de forma explícita que la Agenda 2030, aprobada en la Cumbre del Desarrollo Sostenible de septiembre de 2015, contiene 17 objetivos de desarrollo sostenible de aplicación universal, que desde el 1 de enero de 2016 rigen los esfuerzos de los países para lograr un mundo sostenible en el año 2030."
    },
    {
        pregunta: "¿En qué condiciones se establece la transferencia a los países en desarrollo de tecnologías ecológicamente racionales?",
        opciones: [ "A) En condiciones exclusivamente comerciales determinadas por organismos internacionales", "B) En condiciones favorables, e incluso en condiciones concesionarias y preferenciales establecidas de mutuo acuerdo", "C) En condiciones unilaterales fijadas por los países desarrollados donantes", "D) En condiciones de exclusividad vinculadas a acuerdos bilaterales de libre comercio" ],
        correcta: 1,
        explicacion: "El texto indica expresamente que la transferencia de tecnologías ecológicamente racionales a los países en desarrollo se realizará «en condiciones favorables, e incluso en condiciones concesionarias y preferenciales establecidas de mutuo acuerdo», lo que descarta las opciones de condiciones comerciales, unilaterales o de exclusividad."
    },
    {
        pregunta: "¿Qué indicadores se busca aumentar considerablemente de aquí a 2030 en materia de investigación y desarrollo?",
        opciones: [ "A) El número de personas que trabajan en I+D por millón de habitantes y los gastos de los sectores público y privado en I+D", "B) El número de patentes registradas por millón de habitantes y los gastos exclusivamente del sector público en I+D", "C) El número de centros de investigación por millón de habitantes y los gastos exclusivamente del sector público en I+D", "D) El número de universidades por millón de habitantes y los gastos del sector privado en innovación tecnológica" ],
        correcta: 0,
        explicacion: "El texto señala textualmente que se busca «aumentando considerablemente, de aquí a 2030, el número de personas que trabajan en investigación y desarrollo por millón de habitantes y los gastos de los sectores público y privado en investigación y desarrollo». Las opciones incorrectas sustituyen los indicadores reales por patentes, universidades o centros de investigación, y limitan los gastos a un solo sector, lo cual contradice el documento."
    },
    {
        pregunta: "¿Qué debe hacerse cuando el interesado o su representante rechace la notificación de una actuación administrativa?",
        opciones: [ "A) Se hará constar en el expediente, especificándose las circunstancias del intento de notificación y el medio, dando por efectuado el trámite y siguiéndose el procedimiento.", "B) Se requerirá al interesado que designe un nuevo domicilio para la notificación en un plazo de diez días.", "C) Se considerará nula la notificación y se iniciará un nuevo procedimiento de notificación por comparecencia personal.", "D) Se suspenderá el procedimiento hasta que el interesado acepte la notificación por un medio alternativo." ],
        correcta: 0,
        explicacion: "El texto establece expresamente que, cuando el interesado o su representante rechace la notificación, se hará constar en el expediente especificando las circunstancias del intento y el medio, dando por efectuado el trámite y siguiéndose el procedimiento. Las demás opciones inventan efectos (suspensión, nulidad, requerimiento de nuevo domicilio) que no aparecen en el texto."
    },
    {
        pregunta: "¿En qué plazo debe enviarse el acuse de recibo por correo electrónico u otro medio de comunicación electrónica equivalente a la dirección señalada por el aceptante?",
        opciones: [ "A) En el plazo de las veinticuatro horas siguientes a la recepción de la aceptación.", "B) En el plazo de setenta y dos horas siguientes a la recepción de la aceptación.", "C) En el plazo de cuarenta y ocho horas siguientes a la recepción de la aceptación.", "D) En el plazo de diez días naturales siguientes a la recepción de la aceptación." ],
        correcta: 0,
        explicacion: "El texto indica de forma literal que el acuse de recibo debe enviarse «en el plazo de las veinticuatro horas siguientes a la recepción de la aceptación». Las opciones incorrectas alteran el plazo (48 h, 72 h, 10 días) que no se menciona en el documento."
    },
    {
        pregunta: "¿A qué prestará especial atención la Estrategia en materia de no discriminación, además de los principios básicos y las medidas específicas para personas LGTBI?",
        opciones: [ "A) A las discriminaciones exclusivamente en el ámbito público.", "B) A las discriminaciones derivadas de la edad o la nacionalidad.", "C) A las discriminaciones individuales y aisladas.", "D) A las discriminaciones múltiples e interseccionales." ],
        correcta: 3,
        explicacion: "El texto señala expresamente que «La Estrategia prestará especial atención a las discriminaciones múltiples e interseccionales». Las demás opciones (discriminaciones individuales, exclusivamente públicas, o derivadas de edad/nacionalidad) no figuran en el documento como objeto de atención especial de la Estrategia."
    },
    {
        pregunta: "En las unidades electorales con un censo de entre 31 y 49 funcionarios, ¿cuál es la composición de la representación por delegados de personal?",
        opciones: [ "A) Dos delegados que ejercerán su representación conjunta y mancomunadamente", "B) Tres delegados que ejercerán su representación de forma individual y separada", "C) Un delegado que ejercerá su representación conjunta y mancomunadamente con la junta de personal", "D) Tres delegados que ejercerán su representación conjunta y mancomunadamente" ],
        correcta: 3,
        explicacion: "El texto establece expresamente que de 31 a 49 funcionarios se elegirán tres delegados, que ejercerán su representación conjunta y mancomunadamente. Las demás opciones alteran el número de delegados o la forma de ejercicio de la representación."
    },
    {
        pregunta: "¿Sobre qué principios deben basarse los procedimientos mediante los cuales las Administraciones Públicas proveen los puestos de trabajo?",
        opciones: [ "A) Igualdad, mérito, capacidad y publicidad", "B) Igualdad, mérito, antigüedad y publicidad", "C) Mérito, capacidad, eficiencia y publicidad", "D) Igualdad, antigüedad, capacidad y transparencia" ],
        correcta: 0,
        explicacion: "El texto indica de forma literal que las Administraciones Públicas proveerán los puestos de trabajo mediante procedimientos basados en los principios de igualdad, mérito, capacidad y publicidad. Las opciones incorrectas sustituyen alguno de estos principios por otros no mencionados (antigüedad, transparencia, eficiencia)."
    },
];
