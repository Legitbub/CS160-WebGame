import { CutscenePayload, CutsceneSlide } from "../scenes/Cutscene";

export const INTRO_CUTSCENE: CutscenePayload = {
    slides: [
        {
            textureKey: "intro_slide",
            text: "Hi sweetie, it's Mom! I am so excited to visit you! How is the new job?",
            textColor: '#ffffff',
            // Ken Burns arcade zoom/pan: subtle punch-in toward mom's thought bubble
            zoom: 1.15,
            panX: -20,
            panY: 10,
            duration: 5000,
            // sfxKey: 'phone_ring',
            // // bgmKey: 'intro_bgm'
        },
        {
            textureKey: "intro_slide",
            text: "Uh yeah...it's great Mom, haha...",
            textColor: '#ffffff',
            zoom: 1,
            panX: 0,
            panY: 0,
            duration: 1000,
            // sfxKey: 'phone_ring', 
            // bgmKey: 'intro_bgm'
        },
        {
            textureKey: "intro_slide",
            text: "Ok, can't wait to see you tonight! Goodbye sweetie!",
            textColor: '#ffffff',
            zoom: 1,
            panX: 0,
            panY: 0,
            duration: 5000,
            // sfxKey: 'phone_ring', 
            // bgmKey: 'intro_bgm'
        },
        {
            textureKey: "intro_slide_2",
            text: "Oh man, I need to get a job...........NOW!!!!!",
            textColor: '#ffffff',
            zoom: 1,
            panX: 0,
            panY: 0,
        }
    ],
    nextSceneKey: "Game",
    nextSceneData: {}
};

export const BANK_CUTSCENE_SLIDES: CutsceneSlide[] = [
    {
        textureKey: "outside_bank",
        text: "*Sigh* I guess I could try at the bank... Hopefully this goes well.",
        textColor: '#ffffff',
        zoom: 1,
        panX: 0,
        panY: 0,
    },
    {
        textureKey: "outside_bank",
        text: "*BANG!*",
        textColor: '#ffffff',
        zoom: 1,
        panX: 0,
        panY: 0,
    },
    {
        textureKey: "outside_bank",
        text: "Huh?!",
        textColor: '#ffffff',
        zoom: 1,
        panX: 0,
        panY: 0,
    },
    {
        textureKey: "entering_bank",
        text: "You there! We're being robbed!",
        textColor: '#ffffff',
        zoom: 1,
        panX: 0,
        panY: 0,
    },
    {
        textureKey: "entering_bank",
        text: "I was just looking for a job...",
        textColor: '#ffffff',
        zoom: 1,
        panX: 0,
        panY: 0,
    },
    {
        textureKey: "entering_bank",
        text: "Then you're security now! Get over here and help me fight these punks off!",
        textColor: '#ffffff',
        zoom: 1,
        panX: 0,
        panY: 0,
    },
    {
        textureKey: "entering_bank",
        text: "Wait what?!",
        textColor: '#ffffff',
        zoom: 1,
        panX: 0,
        panY: 0,
    }
];

export const PIZZA_CUTSCENE_SLIDES: CutsceneSlide[] = [
    {
        textureKey: "outside_pizza",
        text: "Oh look, a 'Help Wanted' sign at the pizza shop! Surely making pizzas is safe...",
        textColor: '#ffffff',
        zoom: 1,
        panX: 0,
        panY: 0,
    },
    {
        textureKey: "entering_pizza",
        text: "Mamma mia! Thank goodness you're here! The lunch rush is out of control!",
        textColor: '#ffffff',
        zoom: 1,
        panX: 0,
        panY: 0,
    },
    {
        textureKey: "entering_pizza",
        text: "Uh, hi, I just saw the sign in the window—",
        textColor: '#ffffff',
        zoom: 1,
        panX: 0,
        panY: 0,
    },
    {
        textureKey: "entering_pizza",
        text: ("No time for interviews! Get behind the counter and start making " +
            "those pies before this whole place burns down!\nWe got some hungry bambinos to feed!"),
        textColor: '#ffffff',
        zoom: 1,
        panX: 0,
        panY: 0,
    }
];

export const CITY_DOOR_CUTSCENES: Record<string, CutsceneSlide[]> = {
    Battle_in_Bank: BANK_CUTSCENE_SLIDES,
    PizzaShop: PIZZA_CUTSCENE_SLIDES
};

export const ENDING_CUTSCENE: CutscenePayload = {
    slides: [
        {
            textureKey: "getting_back_home",
            text: "Ugh... what a brutal day. Security guard, pizza chef, delivery driver... none of those jobs worked out.",
            textColor: '#ffffff',
            zoom: 1,
            panX: 0,
            panY: 0,
        },
        {
            textureKey: "frustrated",
            text: "Mom is going to be here any minute! What am I supposed to tell her?!",
            textColor: '#ffffff',
            zoom: 1,
            panX: 0,
            panY: 0,
        },
        {
            textureKey: "frustrated",
            text: "*sigh*...If only getting a job was as easy as playing a video game...",
            textColor: '#ffffff',
            zoom: 1,
            panX: 0,
            panY: 0,
        },
        {
            textureKey: "inspiration",
            text: "Game...Wait that's it!",
            textColor: '#ffffff',
            zoom: 1,
            panX: 0,
            panY: 0,
        },
        {
            textureKey: "gamedeving",
            text: "Just add the bank shootout, the pizza rush, the crazy traffic... and done! 'Get a Job!' is finished!",
            textColor: '#ffffff',
            zoom: 1,
            panX: 0,
            panY: 0,
        },
        {
            textureKey: "mom_arrives",
            text: "Hi sweetie! Mom's here! Tell me all about your new job!",
            textColor: '#ffffff',
            zoom: 1,
            panX: 0,
            panY: 0,
        },
        {
            textureKey: "mom_arrives",
            text: "Hey Mom! Look—I'm an indie game developer now! I just made my own game!",
            textColor: '#ffffff',
            zoom: 1,
            panX: 0,
            panY: 0,
        },
        {
            textureKey: "celebrate",
            text: "Oh, I'm so proud of you sweetie! A real game developer!",
            textColor: '#ffffff',
            zoom: 1,
            panX: 0,
            panY: 0,
        },
        {
            textureKey: "celebrate",
            text: "Phew... haha, thanks Mom! (That was way too close...)",
            textColor: '#ffffff',
            zoom: 1,
            panX: 0,
            panY: 0,
        },
        {
            textureKey: "celebrate",
            text: "And how much money have you made so far?",
            textColor: '#ffffff',
            zoom: 1,
            panX: 0,
            panY: 0,
        },
        {
            textureKey: "ending",
            text: "Oh...uh, I guess I haven't sold any copies yet...",
            textColor: '#ffffff',
            zoom: 1,
            panX: 0,
            panY: 0,
        },
        {
            textureKey: "ending",
            text: "Haha, sounds like you might need to...",
            textColor: '#ffffff',
            zoom: 1,
            panX: 0,
            panY: 0,
        }
    ],
    nextSceneKey: "MainMenu",
    nextSceneData: {}
};

